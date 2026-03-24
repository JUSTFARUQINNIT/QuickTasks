import express from "express";
import multer from "multer";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { adminDb } from "../utils/firebase.js";
import { requireAuth, requireTaskAccess } from "../utils/authMiddleware.js";
import {
  uploadBufferToGoogleDrive,
  deleteGoogleDriveFile,
} from "../utils/googleDrive.js";

const router = express.Router();

const MAX_UPLOAD_SIZE_BYTES = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 10485760);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
});

function canDeleteFile(user, task, file) {
  return user.id === task.ownerId || user.id === file.uploadedBy;
}

function normalizeAttachment(attachment = {}) {
  return {
    id: attachment.id,
    taskId: attachment.taskId || attachment.task_id || null,
    originalName: attachment.originalName || attachment.name || "",
    uniqueName: attachment.uniqueName || attachment.storageName || "",
    uploadedBy: attachment.uploadedBy || attachment.uploaded_by || "",
    driveFileId: attachment.driveFileId || attachment.drive_file_id || null,
    url: attachment.url || "",
    createdAt:
      attachment.createdAt ||
      attachment.uploaded_at ||
      new Date().toISOString(),
    size: attachment.size || 0,
    mimeType:
      attachment.mimeType || attachment.type || "application/octet-stream",
    viewUrl: attachment.viewUrl || attachment.view_url || null,
    iconLink: attachment.iconLink || null,
    thumbnailLink: attachment.thumbnailLink || null,
  };
}

router.post(
  "/:taskId/attachments",
  requireAuth,
  requireTaskAccess,
  upload.single("file"),
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const originalName = file.originalname;
      const uniqueName = `${taskId}_${Date.now()}_${originalName}`;

      const driveUpload = await uploadBufferToGoogleDrive({
        buffer: file.buffer,
        fileName: uniqueName,
        mimeType: file.mimetype,
        folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || undefined,
      });

      if (!driveUpload.downloadUrl) {
        return res
          .status(502)
          .json({ error: "File uploaded but no public download URL was returned" });
      }

      const attachment = {
        id: randomUUID(),
        taskId,
        originalName,
        uniqueName,
        uploadedBy: req.user.uid,
        driveFileId: driveUpload.driveFileId || null,
        mimeType: driveUpload.mimeType,
        size: driveUpload.size || file.size,
        url: driveUpload.downloadUrl,
        iconLink: driveUpload.iconLink,
        thumbnailLink: driveUpload.thumbnailLink,
        viewUrl: driveUpload.viewUrl,
        createdAt: new Date().toISOString(),
      };

      await adminDb.collection("tasks").doc(taskId).update({
        attachments: FieldValue.arrayUnion(attachment),
      });

      return res.status(201).json({
        ok: true,
        attachment,
      });
    } catch (error) {
      console.error("Task attachment upload error:", error);
      return res.status(500).json({
        error:
          error?.message || "Failed to upload attachment to Google Drive",
      });
    }
  },
);

router.delete(
  "/:taskId/attachments/:attachmentId",
  requireAuth,
  requireTaskAccess,
  async (req, res) => {
    try {
      const { taskId, attachmentId } = req.params;
      const taskRef = adminDb.collection("tasks").doc(taskId);
      const taskSnap = await taskRef.get();

      if (!taskSnap.exists) {
        return res.status(404).json({ error: "Task not found" });
      }

      const taskData = taskSnap.data() || {};
      const attachments = Array.isArray(taskData.attachments)
        ? taskData.attachments
        : [];
      const existingRaw = attachments.find((item) => item.id === attachmentId);

      if (!existingRaw) {
        return res.status(404).json({ error: "File not found" });
      }

      const normalized = normalizeAttachment(existingRaw);
      const user = { id: req.user.uid };
      const task = { ownerId: taskData.user_id || taskData.ownerId || null };
      const file = { uploadedBy: normalized.uploadedBy };

      if (!canDeleteFile(user, task, file)) {
        return res.status(403).json({ error: "Unauthorized to delete this file" });
      }

      if (!normalized.driveFileId) {
        return res
          .status(500)
          .json({ error: "Missing driveFileId for selected file" });
      }

      await deleteGoogleDriveFile(normalized.driveFileId);

      const nextAttachments = attachments.filter((item) => item.id !== attachmentId);
      await taskRef.update({ attachments: nextAttachments });

      return res.json({ ok: true });
    } catch (error) {
      console.error("Task attachment delete error:", error);
      return res
        .status(500)
        .json({ error: error?.message || "Failed to delete file from Google Drive" });
    }
  },
);

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: `File too large. Max upload size is ${Math.floor(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))} MB`,
      });
    }
    return res.status(400).json({ error: error.message });
  }

  return next(error);
});

export default router;
