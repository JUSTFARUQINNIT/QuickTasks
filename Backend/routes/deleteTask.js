import express from "express";
import { adminDb } from "../utils/firebase.js";
import { requireAuth } from "../utils/authMiddleware.js";

const router = express.Router();

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

router.delete("/delete-task/:taskId", requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.body || {};

    if (!taskId) {
      return res.status(400).json({ error: "Task ID is required" });
    }
    if (typeof userId !== "string" || userId.length === 0) {
      return res.status(400).json({ error: "userId is required" });
    }

    const authedUid = req.user?.uid;
    if (!authedUid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (authedUid !== userId) {
      return res
        .status(403)
        .json({ error: "userId does not match authenticated user" });
    }

    const taskRef = adminDb.collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) {
      return res.status(404).json({ error: "Task not found" });
    }

    const taskData = taskSnap.data() || {};
    const ownerId =
      typeof taskData.user_id === "string"
        ? taskData.user_id
        : typeof taskData.ownerId === "string"
          ? taskData.ownerId
          : null;

    if (!ownerId) {
      return res.status(400).json({ error: "Task owner is missing" });
    }
    if (ownerId !== authedUid) {
      return res.status(403).json({ error: "Only task owner can delete this task" });
    }

    const collaborators = Array.isArray(taskData.collaborators)
      ? taskData.collaborators.filter((c) => typeof c === "string" && c.length > 0)
      : [];

    const [invitesSnap, notificationsSnap, commentsSnap] = await Promise.all([
      adminDb.collection("taskInvites").where("taskId", "==", taskId).get(),
      adminDb.collection("notifications").where("taskId", "==", taskId).get(),
      adminDb.collection("task_comments").where("task_id", "==", taskId).get(),
    ]);

    // Best-effort cleanup: remove any userTasks projections where `ref` points to this task.
    // If this query fails for any reason, we still proceed with the main deletion.
    let userTaskByRefSnap = { docs: [], size: 0 };
    try {
      userTaskByRefSnap = await adminDb
        .collectionGroup("tasks")
        .where("ref", "==", taskId)
        .get();
    } catch (extraError) {
      console.error("Optional userTasks cleanup failed:", extraError);
    }

    const deletes = [
      taskRef,
      adminDb.collection("userTasks").doc(ownerId).collection("tasks").doc(taskId),
      ...collaborators.map((uid) =>
        adminDb.collection("userTasks").doc(uid).collection("tasks").doc(taskId),
      ),
      ...invitesSnap.docs.map((d) => d.ref),
      ...notificationsSnap.docs.map((d) => d.ref),
      ...commentsSnap.docs.map((d) => d.ref),
      ...userTaskByRefSnap.docs.map((d) => d.ref),
    ];

    const MAX_BATCH_OPS = 450;
    for (const refs of chunkArray(deletes, MAX_BATCH_OPS)) {
      const batch = adminDb.batch();
      refs.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    return res.json({
      ok: true,
      deleted: {
        taskId,
        ownerId,
        collaboratorCount: collaborators.length,
        invites: invitesSnap.size,
        notifications: notificationsSnap.size,
        comments: commentsSnap.size,
        userTasksByRef: userTaskByRefSnap.size,
      },
    });
  } catch (e) {
    console.error("Delete task error:", e);
    const message = e instanceof Error ? e.message : "Failed to delete task";
    return res.status(500).json({ error: message });
  }
});

export default router;
