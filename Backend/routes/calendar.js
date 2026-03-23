import express from "express";
import { requireAuth, requireTaskAccess } from "../utils/authMiddleware.js";
import {
  generateGoogleAuthUrl,
  handleGoogleCallback,
  syncTaskToGoogleCalendar,
  deleteTaskEventFromGoogle,
} from "../services/calendarService.js";

const router = express.Router();

router.post("/google/connect", requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const url = generateGoogleAuthUrl(uid);
    return res.json({ ok: true, authUrl: url });
  } catch (e) {
    console.error("Google connect error:", e);
    return res.status(500).json({ error: "Failed to start Google OAuth" });
  }
});

router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).send("Missing code/state");
    }

    await handleGoogleCallback(String(code), String(state));
    const appUrl = process.env.APP_URL ?? "http://localhost:5173";
    return res.redirect(`${appUrl}/settings/calendar-connected`);
  } catch (e) {
    console.error("Google OAuth callback error:", e);
    return res.status(500).send("Failed to connect Google Calendar");
  }
});

router.post(
  "/google/sync-task/:taskId",
  requireAuth,
  requireTaskAccess,
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const { action } = req.body || {};

      if (action === "delete") {
        await deleteTaskEventFromGoogle(taskId);
        return res.json({ ok: true, deleted: true });
      }

      const event = await syncTaskToGoogleCalendar(taskId);
      return res.json({ ok: true, event });
    } catch (e) {
      console.error("Sync task to Google error:", e);
      return res
        .status(500)
        .json({ error: e.message || "Sync to Google Calendar failed" });
    }
  },
);

export default router;
