import express from "express";
import { sendDailyReminderEmails } from "../services/reminderService.js";

const router = express.Router();

/**
 * Cron-job.org setup:
 * 1. Create a cron job at https://console.cron-job.org/dashboard
 * 2. Set the URL to: https://YOUR_BACKEND_URL/api/reminders/send-daily
 * 3. Set schedule (e.g. 08:00 daily for production; use a few minutes from now for testing).
 * 4. Add a request header: X-Cron-Secret = your CRON_SECRET env value (so only the cron service can trigger it).
 * 5. Method: GET or POST both work.
 */

function validateCronSecret(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers["x-cron-secret"];
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "").trim();
  const query = req.query?.cron_secret;
  return header === secret || bearer === secret || query === secret;
}

async function handleSendDaily(req, res) {
  if (!validateCronSecret(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    console.log("Running scheduled daily reminders (triggered by cron)...");
    const result = await sendDailyReminderEmails();
    return res.json({ ok: true, ...result });
  } catch (e) {
    console.error("Reminder cron error:", e);
    return res.status(500).json({ error: e?.message ?? "Reminder failed" });
  }
}

router.get("/send-daily", handleSendDaily);
router.post("/send-daily", handleSendDaily);

export default router;
