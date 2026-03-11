import express from "express";
import { adminAuth, adminDb } from "../utils/firebase.js";
import { mailTransport } from "../utils/mailer.js";

const router = express.Router();

// Helpers
async function getUserByEmailSafe(email) {
  try {
    const record = await adminAuth.getUserByEmail(email);
    return record;
  } catch {
    return null;
  }
}

async function sendGenericEmail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM ?? `QuickTasks <${process.env.EMAIL_USER}>`;
  await mailTransport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

function buildAppUrl(path = "") {
  const base = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${base}${cleanPath}`;
}

// 2A. Invite users by email to collaborate on a "project".
// In this app we treat the project as a logical workspace identified by projectId
// (e.g. a category ID or other string chosen by the frontend).
router.post("/projects/:projectId/invites", async (req, res) => {
  try {
    const projectId = String(req.params.projectId ?? "").trim();
    const rawEmail = String(req.body?.email ?? "").trim().toLowerCase();
    const inviterUserId = String(req.body?.inviterUserId ?? "").trim();

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required." });
    }
    if (!rawEmail || !rawEmail.includes("@")) {
      return res.status(400).json({ error: "A valid email is required." });
    }
    if (!inviterUserId) {
      return res.status(400).json({ error: "inviterUserId is required." });
    }

    const invitedUserRecord = await getUserByEmailSafe(rawEmail);

    const nowIso = new Date().toISOString();
    const inviteRef = await adminDb.collection("project_invites").add({
      projectId,
      email: rawEmail,
      inviterUserId,
      invitedUserId: invitedUserRecord?.uid ?? null,
      status: "pending",
      createdAt: nowIso,
      respondedAt: null,
    });

    const inviteId = inviteRef.id;
    const acceptUrl = buildAppUrl(`/projects/invites/${inviteId}?projectId=${encodeURIComponent(projectId)}`);

    const subject = "You've been invited to a project";
    const text = [
      "You have been invited to collaborate on a project in QuickTasks.",
      "",
      "Click the link below to accept the invitation:",
      acceptUrl,
    ].join("\n");

    const html = `
      <div style="background:#020617;padding:32px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:520px;margin:0 auto;background:#020617;border-radius:18px;border:1px solid #1f2937;box-shadow:0 18px 45px rgba(15,23,42,0.9);">
          <tr>
            <td style="padding:24px 28px 20px;border-bottom:1px solid #111827;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="font-size:18px;font-weight:600;color:#e5e7eb;">
                    QuickTasks
                  </td>
                  <td align="right" style="font-size:12px;color:#6b7280;">
                    Project invitation
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 16px;">
              <h2 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#f9fafb;font-weight:600;">
                You've been invited to a project
              </h2>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#9ca3af;">
                You have been invited to collaborate on a project in QuickTasks. Click the button below to accept the invitation.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px;">
                <tr>
                  <td>
                    <a href="${acceptUrl}"
                       style="display:inline-block;padding:10px 20px;border-radius:999px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#020617;font-weight:600;font-size:14px;text-decoration:none;">
                      Accept invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#6b7280;">
                If the button doesn’t work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 20px;font-size:11px;line-height:1.5;color:#4b5563;word-break:break-all;">
                ${acceptUrl}
              </p>
            </td>
          </tr>
        </table>
      </div>
    `;

    await sendGenericEmail({ to: rawEmail, subject, text, html });

    // Create an in-app notification for the invited user (if they already have an account).
    if (invitedUserRecord?.uid) {
      await adminDb.collection("notifications").add({
        userId: invitedUserRecord.uid,
        type: "project_invite",
        projectId,
        inviteId,
        read: false,
        createdAt: nowIso,
        data: {
          email: rawEmail,
          inviterUserId,
        },
      });
    }

    return res.json({
      ok: true,
      inviteId,
    });
  } catch (e) {
    console.error("Project invite error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: `Failed to create invite: ${message}` });
  }
});

// 2B. Accept or decline an invite.
router.post("/invites/:inviteId/respond", async (req, res) => {
  try {
    const inviteId = String(req.params.inviteId ?? "").trim();
    const action = String(req.body?.action ?? "").trim().toLowerCase();
    const userId = String(req.body?.userId ?? "").trim();

    if (!inviteId) {
      return res.status(400).json({ error: "inviteId is required." });
    }
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ error: "Action must be 'accept' or 'decline'." });
    }
    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    const inviteRef = adminDb.collection("project_invites").doc(inviteId);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      return res.status(404).json({ error: "Invite not found." });
    }

    const invite = inviteSnap.data() || {};
    if (invite.status && invite.status !== "pending") {
      return res.status(400).json({ error: "Invite has already been responded to." });
    }

    const projectId = String(invite.projectId ?? "").trim();
    const email = String(invite.email ?? "").trim().toLowerCase();
    const inviterUserId = String(invite.inviterUserId ?? "").trim();
    const nowIso = new Date().toISOString();

    await inviteRef.update({
      status: action === "accept" ? "accepted" : "declined",
      invitedUserId: invite.invitedUserId ?? userId,
      respondedAt: nowIso,
    });

    if (action === "accept") {
      // Add to ProjectCollaborators table.
      await adminDb.collection("project_collaborators").add({
        projectId,
        userId,
        role: "member",
        createdAt: nowIso,
      });

      // Notification: user added to project.
      await adminDb.collection("notifications").add({
        userId,
        type: "project_added",
        projectId,
        read: false,
        createdAt: nowIso,
        data: {
          inviteId,
          inviterUserId,
        },
      });

      // Email: "user added to project".
      if (email && email.includes("@")) {
        const subject = "You've been added to a project";
        const text = [
          "You've been added as a collaborator on a project in QuickTasks.",
          "",
          "Open QuickTasks to view the project and its tasks.",
        ].join("\n");

        const html = `
          <div style="background:#020617;padding:32px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:520px;margin:0 auto;background:#020617;border-radius:18px;border:1px solid #1f2937;box-shadow:0 18px 45px rgba(15,23,42,0.9);">
              <tr>
                <td style="padding:24px 28px 20px;border-bottom:1px solid #111827;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="font-size:18px;font-weight:600;color:#e5e7eb;">
                        QuickTasks
                      </td>
                      <td align="right" style="font-size:12px;color:#6b7280;">
                        Project access
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 28px 16px;">
                  <h2 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#f9fafb;font-weight:600;">
                    You're now a collaborator
                  </h2>
                  <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#9ca3af;">
                    You’ve been added to a project in QuickTasks. Open the app to see tasks, add your own, and stay in sync with your team.
                  </p>
                </td>
              </tr>
            </table>
          </div>
        `;

        await sendGenericEmail({ to: email, subject, text, html });
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("Invite respond error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: `Failed to respond to invite: ${message}` });
  }
});

// 2B / 3. Explicitly add collaborators to a project (owner / member).
router.post("/projects/:projectId/collaborators", async (req, res) => {
  try {
    const projectId = String(req.params.projectId ?? "").trim();
    const userId = String(req.body?.userId ?? "").trim();
    const role = String(req.body?.role ?? "member").trim();

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required." });
    }
    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }
    if (!["member", "owner"].includes(role)) {
      return res.status(400).json({ error: "role must be 'member' or 'owner'." });
    }

    const nowIso = new Date().toISOString();
    const collabRef = await adminDb.collection("project_collaborators").add({
      projectId,
      userId,
      role,
      createdAt: nowIso,
    });

    // Notification + email when user added to project.
    await adminDb.collection("notifications").add({
      userId,
      type: "project_added",
      projectId,
      read: false,
      createdAt: nowIso,
      data: { role },
    });

    try {
      const userRecord = await adminAuth.getUser(userId);
      const email = userRecord.email;
      if (email) {
        const subject = "You've been added to a project";
        const text = [
          "You’ve been added to a project in QuickTasks.",
          "",
          "Open QuickTasks to view the project and its tasks.",
        ].join("\n");

        const html = `
          <div style="background:#020617;padding:32px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:520px;margin:0 auto;background:#020617;border-radius:18px;border:1px solid #1f2937;box-shadow:0 18px 45px rgba(15,23,42,0.9);">
              <tr>
                <td style="padding:24px 28px 20px;border-bottom:1px solid #111827;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="font-size:18px;font-weight:600;color:#e5e7eb;">
                        QuickTasks
                      </td>
                      <td align="right" style="font-size:12px;color:#6b7280;">
                        Project access
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 28px 16px;">
                  <h2 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#f9fafb;font-weight:600;">
                    You're now a collaborator
                  </h2>
                  <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#9ca3af;">
                    You’ve been added to a project in QuickTasks. Open the app to see tasks, add your own, and stay in sync with your team.
                  </p>
                </td>
              </tr>
            </table>
          </div>
        `;

        await sendGenericEmail({ to: email, subject, text, html });
      }
    } catch (e) {
      console.error("Project collaborator email error:", e);
    }

    return res.json({ ok: true, id: collabRef.id });
  } catch (e) {
    console.error("Add collaborator error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: `Failed to add collaborator: ${message}` });
  }
});

router.get("/projects/:projectId/collaborators", async (req, res) => {
  try {
    const projectId = String(req.params.projectId ?? "").trim();
    if (!projectId) {
      return res.status(400).json({ error: "projectId is required." });
    }

    const snapshot = await adminDb
      .collection("project_collaborators")
      .where("projectId", "==", projectId)
      .get();

    const collaborators = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    return res.json({ ok: true, collaborators });
  } catch (e) {
    console.error("List collaborators error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: `Failed to load collaborators: ${message}` });
  }
});

// 3. Assign tasks to collaborators.
router.post("/tasks/:taskId/assign", async (req, res) => {
  try {
    const taskId = String(req.params.taskId ?? "").trim();
    const assignedToUserId = String(req.body?.assignedToUserId ?? "").trim();

    if (!taskId) {
      return res.status(400).json({ error: "taskId is required." });
    }
    if (!assignedToUserId) {
      return res.status(400).json({ error: "assignedToUserId is required." });
    }

    const taskRef = adminDb.collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) {
      return res.status(404).json({ error: "Task not found." });
    }

    const nowIso = new Date().toISOString();

    // For assignment we accept either a user UID or an email.
    let finalUserId = assignedToUserId;
    let assignedEmail = null;

    const looksLikeEmail = assignedToUserId.includes("@");
    if (looksLikeEmail) {
      const emailLower = assignedToUserId.trim().toLowerCase();
      let found = null;
      try {
        const record = await adminAuth.getUserByEmail(emailLower);
        found = record;
      } catch {
        found = null;
      }
      if (!found) {
        return res.status(400).json({ error: "No user found with that email." });
      }
      finalUserId = found.uid;
      assignedEmail = found.email ?? emailLower;
    } else {
      try {
        const userRecord = await adminAuth.getUser(assignedToUserId);
        assignedEmail = userRecord.email ?? null;
      } catch {
        assignedEmail = null;
      }
    }

    await taskRef.update({
      assigned_to: finalUserId,
      assigned_email: assignedEmail,
      assigned_at: nowIso,
    });

    // Notification for the assignee.
    await adminDb.collection("notifications").add({
      userId: finalUserId,
      type: "task_assigned",
      taskId,
      read: false,
      createdAt: nowIso,
    });

    // Email for the assignee.
    try {
      const userRecord = await adminAuth.getUser(finalUserId);
      const email = userRecord.email;
      if (email) {
        const task = taskSnap.data() || {};
        const title = String(task.title ?? "A task");

        const subject = "A task has been assigned to you";
        const text = [
          `The task "${title}" has been assigned to you in QuickTasks.`,
          "",
          "Open QuickTasks to review the details and plan your work.",
        ].join("\n");

        const html = `
          <div style="background:#020617;padding:32px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:520px;margin:0 auto;background:#020617;border-radius:18px;border:1px solid #1f2937;box-shadow:0 18px 45px rgba(15,23,42,0.9);">
              <tr>
                <td style="padding:24px 28px 20px;border-bottom:1px solid #111827;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td style="font-size:18px;font-weight:600;color:#e5e7eb;">
                        QuickTasks
                      </td>
                      <td align="right" style="font-size:12px;color:#6b7280;">
                        Task assignment
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 28px 16px;">
                  <h2 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#f9fafb;font-weight:600;">
                    A task was assigned to you
                  </h2>
                  <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#9ca3af;">
                    The task "<strong>${title}</strong>" has been assigned to you in QuickTasks.
                  </p>
                </td>
              </tr>
            </table>
          </div>
        `;

        await sendGenericEmail({ to: email, subject, text, html });
      }
    } catch (e) {
      console.error("Task assignment email error:", e);
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("Task assign error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: `Failed to assign task: ${message}` });
  }
});

// 4. Task comments.
router.post("/tasks/:taskId/comments", async (req, res) => {
  try {
    const taskId = String(req.params.taskId ?? "").trim();
    const authorUserId = String(req.body?.authorUserId ?? "").trim();
    const text = String(req.body?.text ?? "").trim();

    if (!taskId) {
      return res.status(400).json({ error: "taskId is required." });
    }
    if (!authorUserId) {
      return res.status(400).json({ error: "authorUserId is required." });
    }
    if (!text) {
      return res.status(400).json({ error: "Comment text is required." });
    }

    const nowIso = new Date().toISOString();
    const commentRef = await adminDb.collection("task_comments").add({
      taskId,
      authorUserId,
      text,
      createdAt: nowIso,
    });

    const taskRef = adminDb.collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();
    if (taskSnap.exists) {
      const task = taskSnap.data() || {};
      const assignedTo = String(task.assigned_to ?? "").trim();

      if (assignedTo && assignedTo !== authorUserId) {
        // Notification for the assignee.
        await adminDb.collection("notifications").add({
          userId: assignedTo,
          type: "task_comment",
          taskId,
          read: false,
          createdAt: nowIso,
          data: {
            authorUserId,
          },
        });

        // Email for the assignee.
        try {
          const userRecord = await adminAuth.getUser(assignedTo);
          const email = userRecord.email;
          if (email) {
            const title = String(task.title ?? "A task");

            const subject = "New comment on a task assigned to you";
            const plain = [
              `Someone commented on the task "${title}" assigned to you in QuickTasks:`,
              "",
              text,
            ].join("\n");

            const html = `
              <div style="background:#020617;padding:32px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:520px;margin:0 auto;background:#020617;border-radius:18px;border:1px solid #1f2937;box-shadow:0 18px 45px rgba(15,23,42,0.9);">
                  <tr>
                    <td style="padding:24px 28px 20px;border-bottom:1px solid #111827;">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                        <tr>
                          <td style="font-size:18px;font-weight:600;color:#e5e7eb;">
                            QuickTasks
                          </td>
                          <td align="right" style="font-size:12px;color:#6b7280;">
                            Task comment
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 28px 16px;">
                      <h2 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#f9fafb;font-weight:600;">
                        New comment on your task
                      </h2>
                      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#9ca3af;">
                        Someone added a new comment on the task "<strong>${title}</strong>" assigned to you.
                      </p>
                      <blockquote style="margin:0 0 14px;padding:10px 12px;border-radius:8px;background:#020617;border:1px solid #1f2937;font-size:13px;line-height:1.5;color:#e5e7eb;">
                        ${text}
                      </blockquote>
                    </td>
                  </tr>
                </table>
              </div>
            `;

            await sendGenericEmail({ to: email, subject, text: plain, html });
          }
        } catch (e) {
          console.error("Task comment email error:", e);
        }
      }
    }

    return res.json({ ok: true, id: commentRef.id });
  } catch (e) {
    console.error("Task comment error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: `Failed to add comment: ${message}` });
  }
});

router.get("/tasks/:taskId/comments", async (req, res) => {
  try {
    const taskId = String(req.params.taskId ?? "").trim();
    if (!taskId) {
      return res.status(400).json({ error: "taskId is required." });
    }

    const snapshot = await adminDb
      .collection("task_comments")
      .where("taskId", "==", taskId)
      .orderBy("createdAt", "asc")
      .get();

    const comments = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    return res.json({ ok: true, comments });
  } catch (e) {
    console.error("List comments error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: `Failed to load comments: ${message}` });
  }
});

// 5. Notifications system: unread count + list.
router.get("/notifications", async (req, res) => {
  try {
    const userId = String(req.query.userId ?? "").trim();
    const unreadOnly = String(req.query.unreadOnly ?? "").trim().toLowerCase() === "true";

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    let query = adminDb.collection("notifications").where("userId", "==", userId);
    if (unreadOnly) {
      query = query.where("read", "==", false);
    }

    const snapshot = await query.orderBy("createdAt", "desc").limit(20).get();
    const notifications = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));

    const unreadCountSnap = await adminDb
      .collection("notifications")
      .where("userId", "==", userId)
      .where("read", "==", false)
      .get();

    return res.json({
      ok: true,
      notifications,
      unreadCount: unreadCountSnap.size,
    });
  } catch (e) {
    console.error("Notifications fetch error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: `Failed to load notifications: ${message}` });
  }
});

router.post("/notifications/mark-read", async (req, res) => {
  try {
    const userId = String(req.body?.userId ?? "").trim();
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id) => String(id)) : [];

    if (!userId) {
      return res.status(400).json({ error: "userId is required." });
    }

    const nowIso = new Date().toISOString();

    if (ids.length > 0) {
      const batch = adminDb.batch();
      for (const id of ids) {
        const ref = adminDb.collection("notifications").doc(id);
        batch.update(ref, { read: true, readAt: nowIso });
      }
      await batch.commit();
    } else {
      const snapshot = await adminDb
        .collection("notifications")
        .where("userId", "==", userId)
        .where("read", "==", false)
        .get();
      const batch = adminDb.batch();
      snapshot.forEach((doc) => {
        batch.update(doc.ref, { read: true, readAt: nowIso });
      });
      await batch.commit();
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error("Notifications mark-read error:", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: `Failed to mark notifications as read: ${message}` });
  }
});

export default router;

