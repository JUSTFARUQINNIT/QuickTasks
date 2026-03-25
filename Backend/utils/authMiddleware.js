import { adminAuth, adminDb } from "./firebase.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [, token] = header.split(" ");

    console.log("🔑 Auth check:", {
      header: header.substring(0, 20) + "...",
      hasToken: !!token,
    });

    if (!token) {
      console.log("❌ Missing auth token");
      return res.status(401).json({ error: "Missing auth token" });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    console.log("✅ Auth verified for user:", decoded.uid);
    req.user = { uid: decoded.uid };
    return next();
  } catch (e) {
    console.error("❌ Auth error:", e);
    return res.status(401).json({ error: "Invalid auth token" });
  }
}

export async function requireTaskAccess(req, res, next) {
  try {
    const { taskId } = req.params;
    if (!taskId) {
      return res.status(400).json({ error: "Missing taskId" });
    }

    console.log("🔐 Checking task access for:", {
      taskId,
      userId: req.user?.uid,
    });

    const snap = await adminDb.collection("tasks").doc(taskId).get();
    if (!snap.exists) {
      console.log("❌ Task not found:", taskId);
      return res.status(404).json({ error: "Task not found" });
    }

    const data = snap.data() || {};
    const ownerId = typeof data.user_id === "string" ? data.user_id : null;
    const collaborators = Array.isArray(data.collaborators)
      ? data.collaborators
      : [];

    console.log("📋 Task data:", { ownerId, collaborators, taskData: data });

    const uid = req.user?.uid;
    const canAccess = !!uid && (ownerId === uid || collaborators.includes(uid));

    console.log("👤 Access check:", { uid, ownerId, collaborators, canAccess });

    if (!canAccess) {
      console.log("🚫 Access denied for user:", uid);
      return res.status(403).json({ error: "Forbidden" });
    }

    req.task = { id: taskId, ...data };
    return next();
  } catch (e) {
    console.error("❌ Task access error:", e);
    return res.status(500).json({ error: "Failed to verify task access" });
  }
}
