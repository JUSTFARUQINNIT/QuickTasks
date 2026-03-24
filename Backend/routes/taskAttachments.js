import express from "express";
import multer from "multer";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../utils/firebase.js";
import { requireAuth, requireTaskAccess } from "../utils/authMiddleware.js";
import { uploadBufferToGoogleDrive } from "../utils/googleDrive.js";

const router = express.Router();

const MAX_UPLOAD_SIZE_BYTES = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 10485760);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
});

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

      const driveUpload = await uploadBufferToGoogleDrive({
        buffer: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || undefined,
      });

      if (!driveUpload.downloadUrl) {
        return res
          .status(502)
          .json({ error: "File uploaded but no public download URL was returned" });
      }

      const attachment = {
        id: Date.now().toString(),
        name: driveUpload.name,
        type: driveUpload.mimeType,
        size: driveUpload.size || file.size,
        url: driveUpload.downloadUrl,
        view_url: driveUpload.viewUrl,
        drive_file_id: driveUpload.driveFileId || null,
        uploaded_by: req.user.uid,
        uploaded_at: new Date().toISOString(),
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
