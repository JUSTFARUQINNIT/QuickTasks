import express from "express";
import crypto from "crypto";
import { adminAuth, adminDb } from "../utils/firebase.js";
import { mailTransport } from "../utils/mailer.js";

const router = express.Router();

const APP_URL = process.env.APP_URL ?? "https://quick-tasks-ochre.vercel.app/reset-password";

router.post("/request-password-reset", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email." });
    }

    const userRecord = await adminAuth.getUserByEmail(email);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

    await adminDb.collection("password_resets").doc(tokenHash).set({
      email,
      uid: userRecord.uid,
      expiresAt,
      used: false,
      createdAt: new Date().toISOString(),
    });

    const resetUrl = `${APP_URL}?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;

    const from =
      process.env.MAIL_FROM ?? `QuickTasks <${process.env.EMAIL_USER}>`;

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
                    Password reset
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;">
              <h2 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#f9fafb;font-weight:600;">
                Reset your password
              </h2>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#9ca3af;">
                You requested to reset the password for your QuickTasks account. Click the button below to choose a new password.
              </p>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#6b7280;">
                For security, this link will expire in <strong>1 hour</strong> and can only be used once.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px;">
                <tr>
                  <td>
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:10px 20px;border-radius:999px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#020617;font-weight:600;font-size:14px;text-decoration:none;">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#6b7280;">
                If the button doesn’t work, copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 20px;font-size:11px;line-height:1.5;color:#4b5563;word-break:break-all;">
                ${resetUrl}
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
                If you didn’t request this, you can safely ignore this email.
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
        subject: "Reset your QuickTasks password",
        html,
      });
    } catch (mailError) {
      console.error("Password reset mail send error:", mailError);
      const errMsg =
        mailError instanceof Error ? mailError.message : String(mailError);
      return res.status(502).json({ error: `Failed to send email: ${errMsg}` });
    }

    return res.json({ ok: true, info: "Reset email queued successfully." });
  } catch (e) {
    console.error("Password reset error:", e);
    const errMsg = e instanceof Error ? e.message : String(e);
    return res
      .status(500)
      .json({ error: `Failed to generate reset link: ${errMsg}` });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();
    const token = String(req.body?.token ?? "").trim();
    const newPassword = String(req.body?.newPassword ?? "").trim();

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email." });
    }
    if (!token || token.length < 32) {
      return res.status(400).json({ error: "Invalid reset token." });
    }
    if (!newPassword || newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "Use at least 8 characters for your new password." });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const docRef = adminDb.collection("password_resets").doc(tokenHash);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res
        .status(400)
        .json({ error: "Reset link is invalid or has already been used." });
    }

    const data = snap.data() || {};

    if (data.used) {
      return res
        .status(400)
        .json({ error: "Reset link has already been used." });
    }

    if (!data.expiresAt || Date.now() > data.expiresAt) {
      return res
        .status(400)
        .json({ error: "Reset link has expired. Please request a new one." });
    }

    if ((data.email ?? "").toLowerCase() !== email) {
      return res
        .status(400)
        .json({ error: "Reset link does not match this email address." });
    }

    const uid = data.uid;
    if (!uid) {
      return res
        .status(500)
        .json({ error: "Reset link is missing account information." });
    }

    await adminAuth.updateUser(uid, { password: newPassword });

    await docRef.update({
      used: true,
      usedAt: new Date().toISOString(),
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("Custom reset-password error:", e);
    const errMsg = e instanceof Error ? e.message : String(e);
    return res
      .status(500)
      .json({ error: `Failed to reset password: ${errMsg}` });
  }
});

router.post("/welcome", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email." });
    }

    const from =
      process.env.MAIL_FROM ?? `QuickTasks <${process.env.EMAIL_USER}>`;
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
                  Welcome
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 8px;">
            <h2 style="font-size:22px;line-height:1.3;color:#f9fafb;font-weight:600;">
                Welcome to QuickTasks
            </h2>
            <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#9ca3af;">
              We&apos;re glad you&apos;re here. Your new workspace is ready to help you capture tasks, stay focused,
              and see your progress over time.
            </p>
            <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#6b7280;">
              You can sign in at any time to:
            </p>
            <ul style="margin:0 0 18px 18px;padding:0;font-size:13px;line-height:1.6;color:#9ca3af;">
              <li>Capture tasks with priorities and due dates</li>
              <li>Group work with categories like Work, Personal, or Projects</li>
              <li>See your streak of completed tasks over time</li>
            </ul>
            <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#6b7280;">
              When you&apos;re ready, open QuickTasks and sign in with your email and password.
            </p>
            <p style="margin:0;font-size:11px;line-height:1.6;color:#4b5563;">
              If you didn&apos;t sign up for QuickTasks, you can safely ignore this email.
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
      subject: "Welcome to QuickTasks",
      html,
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error("Welcome email error:", e);
    const errMsg = e instanceof Error ? e.message : String(e);
    return res
      .status(500)
      .json({ error: `Failed to send welcome email: ${errMsg}` });
  }
});

export default router;
