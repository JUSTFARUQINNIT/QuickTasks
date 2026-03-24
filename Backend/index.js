import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import reminderRoutes from "./routes/reminders.js";
import inviteRoutes from "./routes/invites.js";
import commentRoutes from "./routes/comments.js";
import aiTaskRoutes from "./routes/aiTasks.js";
import calendarRoutes from "./routes/calendar.js";
import taskManagerRoutes from "./routes/taskManager.js";
import deleteTaskRoutes from "./routes/deleteTask.js";
import taskAttachmentRoutes from "./routes/taskAttachments.js";
import taskCollaboratorRoutes from "./routes/taskCollaborators.js";

const app = express();

app.use(cors());
app.use(express.json());

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/health", (req, res) => {
  res.json({ message: "Backend running 🚀", ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/tasks", commentRoutes);
app.use("/api/tasks", aiTaskRoutes);
app.use("/api/tasks", taskAttachmentRoutes);
app.use("/api/tasks", taskCollaboratorRoutes);
app.use("/api/tasks/:taskId", taskManagerRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/", deleteTaskRoutes);
app.use("/", inviteRoutes);

const PORT = process.env.PORT || 8787;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  // Daily reminders run via external cron (e.g. cron-job.org) hitting POST/GET /api/reminders/send-daily with CRON_SECRET.
});
