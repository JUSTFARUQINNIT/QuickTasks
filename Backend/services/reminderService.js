import { adminAuth, adminDb } from "../utils/firebase.js";
import { mailTransport } from "../utils/mailer.js";

/** Escape HTML to prevent XSS when embedding task content in emails. */
function escapeHtml(str) {
  if (str == null || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build HTML for a single daily reminder email listing all tasks due today for one user.
 * @param {string} todayStr - Date string YYYY-MM-DD
 * @param {{ title?: string, description?: string }[]} tasks - Tasks due today for this user
 */
function buildDailyReminderHtml(todayStr, tasks) {
  const taskRows = tasks
    .map((task) => {
      const title = escapeHtml(task.title ?? "Untitled task");
      const desc = task.description
        ? `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7280;">${escapeHtml(task.description)}</p>`
        : "";
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #1f2937;">
            <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#e5e7eb;">${title}</p>
            ${desc}
          </td>
        </tr>`;
    })
    .join("");

  return `
    <div style="background:#020617;padding:32px 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:520px;margin:0 auto;background:#020617;border-radius:18px;border:1px solid #1f2937;box-shadow:0 18px 45px rgba(15,23,42,0.9);">
        <tr>
          <td style="padding:24px 28px 20px;border-bottom:1px solid #111827;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="font-size:18px;font-weight:600;color:#e5e7eb;">QuickTasks</td>
                <td align="right" style="font-size:12px;color:#6b7280;">Daily reminder</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 16px;">
            <h2 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#f9fafb;font-weight:600;">
              Tasks due today (${escapeHtml(todayStr)})
            </h2>
            <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#9ca3af;">
              You have ${tasks.length} pending ${tasks.length === 1 ? "task" : "tasks"} due today. Here’s your list:
            </p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              ${taskRows}
            </table>
            <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
              Open QuickTasks to update progress and plan your day.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 20px;border-top:1px solid #111827;font-size:11px;line-height:1.5;color:#4b5563;">
            Sent by QuickTasks • Stay organized, one focused day at a time.
          </td>
        </tr>
      </table>
    </div>`;
}

/**
 * Resolve email for a task owner: use user_email if set, else look up by user_id via Firebase Auth.
 * @param {Record<string, unknown>} data - Task document
 * @param {Map<string, string>} uidToEmail - Cache of uid -> email from Auth
 * @returns {Promise<string|null>}
 */
async function getEmailForTask(data, uidToEmail) {
  const existing = (data.user_email || "").trim().toLowerCase();
  if (existing && existing.includes("@")) return existing;
  const uid = data.user_id;
  if (!uid || typeof uid !== "string") return null;
  if (uidToEmail.has(uid)) return uidToEmail.get(uid);
  try {
    const userRecord = await adminAuth.getUser(uid);
    const email = (userRecord.email || "").trim().toLowerCase();
    if (email && email.includes("@")) {
      uidToEmail.set(uid, email);
      return email;
    }
  } catch {
    // User deleted or not found
  }
  return null;
}

/**
 * Send one daily reminder email per user, each containing all their uncompleted tasks due today.
 * Uses server UTC date for "today". Resolves owner email from user_id via Firebase Auth if user_email is missing.
 * @returns {{ usersEmailed: number, usersSkipped: number, tasksTotal: number, date: string }}
 */
export async function sendDailyReminderEmails() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  let usersEmailed = 0;
  let usersSkipped = 0;
  let tasksTotal = 0;

  try {
    const snapshot = await adminDb
      .collection("tasks")
      .where("completed", "==", false)
      .where("due_date", "==", todayStr)
      .get();

    if (snapshot.empty) {
      console.log(`Daily reminders: no tasks due today (${todayStr}).`);
      return { usersEmailed: 0, usersSkipped: 0, tasksTotal: 0, date: todayStr };
    }

    /** @type {Map<string, string>} uid -> email cache */
    const uidToEmail = new Map();
    /** @type {Map<string, { title?: string, description?: string }[]>} */
    const byUser = new Map();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const email = await getEmailForTask(data, uidToEmail);
      if (!email || !email.includes("@")) continue;
      if (!byUser.has(email)) {
        byUser.set(email, []);
      }
      byUser.get(email).push({
        title: data.title,
        description: data.description,
      });
      tasksTotal += 1;
    }

    if (byUser.size === 0) {
      console.log(
        `Daily reminders: ${snapshot.size} tasks due ${todayStr} but no owner emails could be resolved (check user_id / Auth).`
      );
      return { usersEmailed: 0, usersSkipped: 0, tasksTotal: 0, date: todayStr };
    }

    const from =
      process.env.MAIL_FROM ??
      `QuickTasks <${process.env.MAIL_FROM_EMAIL || process.env.EMAIL_USER || "noreply@quicktasks.local"}>`;

    for (const [email, tasks] of byUser) {
      if (!tasks.length) continue;
      try {
        const html = buildDailyReminderHtml(todayStr, tasks);
        const subject =
          tasks.length === 1
            ? `Reminder: ${tasks[0].title ?? "Task"} due today`
            : `Reminder: ${tasks.length} tasks due today`;

        await mailTransport.sendMail({
          from,
          to: email,
          subject,
          html,
        });
        usersEmailed += 1;
      } catch (e) {
        console.error(`Failed to send daily reminder to ${email}:`, e);
        usersSkipped += 1;
      }
    }

    console.log(
      `Daily reminders (${todayStr}): ${usersEmailed} users emailed, ${usersSkipped} failed, ${tasksTotal} tasks.`
    );
    return { usersEmailed, usersSkipped, tasksTotal, date: todayStr };
  } catch (error) {
    console.error("Failed to load tasks for daily reminders", error);
    return { usersEmailed: 0, usersSkipped: 0, tasksTotal: 0, date: todayStr };
  }
}
