import express from "express";
import { adminDb } from "../utils/firebase.js";
import { requireAuth, requireTaskAccess } from "../utils/authMiddleware.js";

const router = express.Router();

router.get(
  "/:taskId/comments",
  requireAuth,
  requireTaskAccess,
  async (req, res) => {
    try {
      const { taskId } = req.params;

      const snap = await adminDb
        .collection("task_comments")
        .where("task_id", "==", taskId)
        .orderBy("created_at", "asc")
        .get();

      if (snap.empty) {
        return res.json({ ok: true, comments: [] });
      }

      const comments = [];
      const userIds = new Set();

      snap.forEach((doc) => {
        const data = doc.data();
        comments.push({ id: doc.id, ...data });
        if (data.user_id) userIds.add(data.user_id);
      });

      const profilesMap = new Map();
      if (userIds.size > 0) {
        const refs = [...userIds].map((uid) =>
          adminDb.collection("profiles").doc(uid),
        );
        const profileSnaps = await adminDb.getAll(...refs);
        profileSnaps.forEach((pSnap) => {
          if (!pSnap.exists) return;
          const data = pSnap.data() || {};
          profilesMap.set(pSnap.id, {
            name: data.username || data.name || data.email || "Unknown user",
            avatarUrl: data.avatarUrl || null,
          });
        });
      }

      const enriched = comments.map((c) => {
        const profile = profilesMap.get(c.user_id) || {};
        return {
          id: c.id,
          taskId: c.task_id,
          userId: c.user_id,
          commentText: c.comment_text,
          createdAt: c.created_at,
          parentId: c.parent_id || null,
          user: {
            name: profile.name || "Unknown user",
            avatarUrl: profile.avatarUrl,
          },
        };
      });

      return res.json({ ok: true, comments: enriched });
    } catch (e) {
      console.error("Fetch comments error:", e);
      return res.status(500).json({ error: "Failed to load comments" });
    }
  },
);

router.post(
  "/:taskId/comments",
  requireAuth,
  requireTaskAccess,
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const { commentText, parentId } = req.body || {};
      const uid = req.user.uid;

      const trimmed = String(commentText ?? "").trim();
      if (!trimmed) {
        return res.status(400).json({ error: "Comment text is required" });
      }
      if (trimmed.length > 2000) {
        return res.status(400).json({ error: "Comment too long" });
      }

      const nowIso = new Date().toISOString();
      const commentData = {
        task_id: taskId,
        user_id: uid,
        comment_text: trimmed,
        created_at: nowIso,
      };
      if (parentId) {
        commentData.parent_id = parentId;
      }

      const docRef = await adminDb.collection("task_comments").add(commentData);

      return res.status(201).json({
        ok: true,
        id: docRef.id,
        taskId,
        userId: uid,
        commentText: trimmed,
        createdAt: nowIso,
        parentId: parentId || null,
      });
    } catch (e) {
      console.error("Create comment error:", e);
      return res.status(500).json({ error: "Failed to create comment" });
    }
  },
);

export default router;
