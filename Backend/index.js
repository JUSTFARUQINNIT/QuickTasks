import "dotenv/config"
import express from "express"
import cors from "cors"
import cron from "node-cron"

import authRoutes from "./routes/auth.js"
import reminderRoutes from "./routes/reminders.js"
import inviteRoutes from "./routes/invites.js"
import { sendDailyReminderEmails } from "./services/reminderService.js"

const app = express()

app.use(cors())
app.use(express.json())

app.get("/health", (req, res) => {
  res.json({ message: "Backend running 🚀", ok: true })
})

app.use("/api/auth", authRoutes)
app.use("/api/reminders", reminderRoutes)
app.use("/", inviteRoutes)

const PORT = process.env.PORT || 8787

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`)

  cron.schedule("0 8 * * *", () => {
    console.log("Running scheduled reminders...")
    sendDailyReminderEmails()
  })
})