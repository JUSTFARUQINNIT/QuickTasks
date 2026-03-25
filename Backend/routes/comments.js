import express from "express";
import { adminDb } from "../utils/firebase.js";
import { requireAuth, requireTaskAccess } from "../utils/authMiddleware.js";

const router = express.Router();

router.get(
  "/debug/:taskId/comments",
  async (req, res) => {
    try {
      const { taskId } = req.params;
      console.log("🔍 Debug: Checking comments for task:", taskId);

      const allComments = await adminDb
        .collection("task_comments")
        .where("task_id", "==", taskId)
        .get();

      const result = {
        taskId,
        totalComments: allComments.docs.length,
        comments: allComments.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      };

      console.log("🔍 Debug result:", result);
      return res.json(result);
    } catch (e) {
      console.error("🔍 Debug error:", e);
      return res.status(500).json({ error: e.message });
    }
  }
);

router.get(
  "/:taskId/comments",
  requireAuth,
  requireTaskAccess,
  async (req, res) => {
    try {
      const { taskId } = req.params;

      console.log("📥 Backend: Fetching comments for task:", taskId);

      const snap = await adminDb
        .collection("task_comments")
        .where("task_id", "==", taskId)
        .get();

      console.log("📊 Backend: Found", snap.docs.length, "comments for task:", taskId);
      
      // Debug: Check if any comments exist for this task at all
      const allCommentsSnap = await adminDb
        .collection("task_comments")
        .where("task_id", "==", taskId)
        .get();
      console.log("🔍 All comments check:", {
        taskId,
        totalFound: allCommentsSnap.docs.length,
        commentIds: allCommentsSnap.docs.map(d => d.id),
        commentData: allCommentsSnap.docs.map(d => ({ id: d.id, task_id: d.data().task_id, created_at: d.data().created_at }))
      });

      if (snap.empty) {
        console.log("📭 Backend: No comments found, returning empty array");
        return res.json({ ok: true, comments: [] });
      }

      const comments = [];
      const userIds = new Set();

      snap.forEach((doc) => {
        const data = doc.data();
        comments.push({ id: doc.id, ...data });
        if (data.user_id) userIds.add(data.user_id);
      });

      // Sort manually by created_at since we can't use orderBy without index
      comments.sort((a, b) => {
        const aTime = a.created_at || "";
        const bTime = b.created_at || "";
        return aTime.localeCompare(bTime);
      });

      console.log("👥 Backend: User IDs to fetch profiles for:", Array.from(userIds));

      const profilesMap = new Map();
      if (userIds.size > 0) {
        const refs = [...userIds].map((uid) =>
          adminDb.collection("profiles").doc(uid),
        );
        const profileSnaps = await adminDb.getAll(...refs);
        profileSnaps.forEach((pSnap) => {
          if (!pSnap.exists) return;
          const data = pSnap.data() || {};
          console.log("🔍 Profile data for user:", pSnap.id, data);
          profilesMap.set(pSnap.id, {
            name: data.username || data.name || data.email || "Unknown user",
            avatarUrl: data.avatar_data || data.avatar_url || null,
          });
        });
      }

      console.log("👤 Backend: Profiles map:", Object.fromEntries(profilesMap));

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

      console.log("✨ Backend: Enriched comments:", enriched);
      return res.json({ ok: true, comments: enriched });
    } catch (e) {
      console.error("❌ Backend: Fetch comments error:", e);
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

      console.log("🚀 Backend: Creating comment:", { taskId, commentText, parentId, userId: uid });

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

      console.log("💾 Backend: Saving comment data:", commentData);

      const docRef = await adminDb.collection("task_comments").add(commentData);
      
      console.log("✅ Backend: Comment saved with ID:", docRef.id);

      const responseData = {
        ok: true,
        id: docRef.id,
        taskId,
        userId: uid,
        commentText: trimmed,
        createdAt: nowIso,
        parentId: parentId || null,
      };
      
      console.log("📤 Backend: Sending response:", responseData);
      return res.status(201).json(responseData);
    } catch (e) {
      console.error("❌ Backend: Create comment error:", e);
      return res.status(500).json({ error: "Failed to create comment" });
    }
  },
);

export default router;
