import express from "express";
import { mailTransport } from "../utils/mailer.js";

const router = express.Router();

router.post("/send-task-invite-email", async (req, res) => {
  try {
    const { email, taskTitle, invitedBy } = req.body ?? {};

    if (!email || !taskTitle || !invitedBy) {
      return res.status(400).json({
        error: "Missing required fields: email, taskTitle, invitedBy",
      });
    }

    const from =
      process.env.MAIL_FROM ??
      `QuickTasks <${process.env.MAIL_FROM_EMAIL || process.env.EMAIL_USER || "noreply@quicktasks.local"}>`;
    const appUrl =
      process.env.APP_URL ?? "https://quick-tasks-ochre.vercel.app/";

    const safeTaskTitle = String(taskTitle);
    const safeInvitedBy = String(invitedBy);

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
                    Task collaboration invite
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 16px;">
              <h2 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#f9fafb;font-weight:600;">
                You’ve been invited to collaborate
              </h2>
              <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#9ca3af;">
                <strong style="color:#e5e7eb;">${safeInvitedBy}</strong> invited you to collaborate on the task:
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e5e7eb;">
                “${safeTaskTitle}”
              </p>
              <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:#6b7280;">
                Open QuickTasks to review this invitation on your Invitations page and choose to accept or decline.
              </p>
              <p style="margin:0 0 0;font-size:13px;line-height:1.6;color:#9ca3af;">
                <a href="${appUrl}/invitations" style="color:#78d957;text-decoration:none;">Go to Invitations</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 20px;border-top:1px solid #111827;font-size:11px;line-height:1.5;color:#4b5563;">
              Sent by QuickTasks • Stay organized, one focused day at a time.
            </td>
          </tr>
        </table>
      </div>
    `;

    await mailTransport.sendMail({
      from,
      to: email,
      subject: `QuickTasks: Task invite – ${safeTaskTitle}`,
      html,
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("Failed to send task invite email", e);
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
});

export default router;
