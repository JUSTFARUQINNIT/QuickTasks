import { adminAuth, adminDb } from "./firebase.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");

    if (!token) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    req.user = { uid: decoded.uid };
    return next();
  } catch (e) {
    console.error("Auth error:", e);
    return res.status(401).json({ error: "Invalid auth token" });
  }
}

export async function requireTaskAccess(req, res, next) {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ error: "Missing taskId" });
    }

    const snap = await adminDb.collection("tasks").doc(taskId).get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Task not found" });
    }

    const data = snap.data() || {};
    const ownerId = typeof data.user_id === "string" ? data.user_id : null;
    const collaborators = Array.isArray(data.collaborators)
      ? data.collaborators
      : [];

    const uid = req.user?.uid;
    const canAccess = !!uid && (ownerId === uid || collaborators.includes(uid));

    if (!canAccess) {
      return res.status(403).json({ error: "Forbidden" });
    }

    req.task = { id: taskId, ...data };
    return next();
  } catch (e) {
    console.error("Task access error:", e);
    return res.status(500).json({ error: "Failed to verify task access" });
  }
}
