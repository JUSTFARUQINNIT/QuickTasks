import { adminDb } from "../utils/firebase.js";
import { mailTransport } from "../utils/mailer.js";

export async function sendDailyReminderEmails() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = today.toISOString().slice(0, 10);

  try {
    const snapshot = await adminDb
      .collection("tasks")
      .where("completed", "==", false)
      .where("due_date", "==", todayStr)
      .get();

    if (snapshot.empty) {
      return { sent: 0, skipped: 0 };
    }

    let sent = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
      const task = doc.data();

      const email = task.user_email;
      if (!email) {
        skipped += 1;
        continue;
      }

      const from =
        process.env.MAIL_FROM ?? `QuickTasks <${process.env.EMAIL_USER}>`;
      const title = task.title ?? "Task reminder";

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
                      Task reminder
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 16px;">
                <h2 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#f9fafb;font-weight:600;">
                  Reminder: ${title}
                </h2>
                <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#9ca3af;">
                  You have a task due today (${todayStr}). Checking it off keeps your momentum going.
                </p>
                <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:#6b7280;">
                  Open QuickTasks to review this task and your other priorities for today.
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

      try {
        await mailTransport.sendMail({
          from,
          to: email,
          subject: `Reminder: ${title}`,
          html,
        });
        sent += 1;
      } catch (e) {
        console.error("Failed to send reminder email", e);
        const errMsg = e instanceof Error ? e.message : String(e);
        skipped += 1;
        // Keep going but include error detail per task in logs
      }
    }

    return { sent, skipped };
  } catch (error) {
    console.error("Failed to load tasks for reminders", error);
    return { sent: 0, skipped: 0 };
  }
}
