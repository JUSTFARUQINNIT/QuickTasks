import express from "express";
import { sendDailyReminderEmails } from "../services/reminderService.js";

const router = express.Router();

router.post("/send-daily", async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      const header = req.headers["x-cron-secret"];
      if (header !== cronSecret) {
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    const result = await sendDailyReminderEmails();

    res.json({
      ok: true,
      ...result,
    });
  } catch (e) {
    console.error("Reminder error:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
