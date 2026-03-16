import express from "express";
import { requireAuth, requireTaskAccess } from "../utils/authMiddleware.js";
import {
  suggestTaskPriority,
  predictTaskPatterns,
} from "../services/aiTaskService.js";

const router = express.Router();

router.get(
  "/:taskId/ai-suggestions",
  requireAuth,
  requireTaskAccess,
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const uid = req.user.uid;

      const priority = await suggestTaskPriority(taskId, uid);
      const patterns = await predictTaskPatterns(uid);

      return res.json({
        ok: true,
        priority,
        patterns,
      });
    } catch (e) {
      console.error("AI suggestions error:", e);
      return res.status(500).json({ error: "Failed to compute suggestions" });
    }
  }
);

export default router;

