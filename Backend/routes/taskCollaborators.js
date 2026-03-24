import express from "express";
import { adminDb } from "../utils/firebase.js";
import { requireAuth, requireTaskAccess } from "../utils/authMiddleware.js";

const router = express.Router();

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

router.delete(
  "/:taskId/collaborators/:collaboratorId",
  requireAuth,
  requireTaskAccess,
  async (req, res) => {
    try {
      const { taskId, collaboratorId } = req.params;
      const requesterId = req.user?.uid;

      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!taskId || !collaboratorId) {
        return res
          .status(400)
          .json({ error: "taskId and collaboratorId are required" });
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
      if (requesterId !== ownerId) {
        return res
          .status(403)
          .json({ error: "Only the task owner can remove collaborators" });
      }
      if (collaboratorId === ownerId) {
        return res.status(400).json({ error: "Cannot remove task owner" });
      }

      const collaborators = Array.isArray(taskData.collaborators)
        ? taskData.collaborators.filter((c) => typeof c === "string")
        : [];
      if (!collaborators.includes(collaboratorId)) {
        return res.status(404).json({ error: "Collaborator not found" });
      }

      const updatedCollaborators = collaborators.filter(
        (id) => id !== collaboratorId,
      );
      await taskRef.update({ collaborators: updatedCollaborators });

      const taskTitle = String(taskData.title || "a task");
      const nowIso = new Date().toISOString();

      // Notify removed collaborator.
      await adminDb.collection("notifications").add({
        userId: collaboratorId,
        taskId,
        taskTitle,
        type: "removed_from_task",
        message: `You have been removed from the task "${taskTitle}".`,
        isRead: false,
        createdAt: nowIso,
        createdBy: requesterId,
      });

      // Remove collaborator-specific task-related data.
      const [taskInvitesSnap, taskCommentsSnap, taskNotificationsSnap] =
        await Promise.all([
          adminDb
            .collection("taskInvites")
            .where("taskId", "==", taskId)
            .where("inviteeId", "==", collaboratorId)
            .get(),
          adminDb
            .collection("task_comments")
            .where("task_id", "==", taskId)
            .where("user_id", "==", collaboratorId)
            .get(),
          adminDb
            .collection("notifications")
            .where("taskId", "==", taskId)
            .where("userId", "==", collaboratorId)
            .get(),
        ]);

      let userTaskByRefSnap = { docs: [], size: 0 };
      try {
        userTaskByRefSnap = await adminDb
          .collection("userTasks")
          .doc(collaboratorId)
          .collection("tasks")
          .where("ref", "==", taskId)
          .get();
      } catch (extraError) {
        console.error("Optional collaborator userTasks cleanup failed:", extraError);
      }

      const deletes = [
        adminDb
          .collection("userTasks")
          .doc(collaboratorId)
          .collection("tasks")
          .doc(taskId),
        ...userTaskByRefSnap.docs.map((d) => d.ref),
        ...taskInvitesSnap.docs.map((d) => d.ref),
        ...taskCommentsSnap.docs.map((d) => d.ref),
        ...taskNotificationsSnap.docs.map((d) => d.ref),
      ];

      const MAX_BATCH_OPS = 450;
      for (const refs of chunkArray(deletes, MAX_BATCH_OPS)) {
        const batch = adminDb.batch();
        refs.forEach((ref) => batch.delete(ref));
        await batch.commit();
      }

      return res.json({
        ok: true,
        removedCollaboratorId: collaboratorId,
        cleanup: {
          userTasksByRef: userTaskByRefSnap.size,
          invites: taskInvitesSnap.size,
          comments: taskCommentsSnap.size,
          notifications: taskNotificationsSnap.size,
        },
      });
    } catch (e) {
      console.error("Remove collaborator error:", e);
      const message =
        e instanceof Error ? e.message : "Failed to remove collaborator";
      return res.status(500).json({ error: message });
    }
  },
);

export default router;
