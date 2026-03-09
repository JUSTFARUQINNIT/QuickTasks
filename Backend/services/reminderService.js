import { admin } from "../utils/supabase.js"
import { mailTransport } from "../utils/mailer.js"

export async function sendDailyReminderEmails() {

  const today = new Date()
  today.setHours(0,0,0,0)

  const todayStr = today.toISOString().slice(0,10)

  const { data: tasks, error } = await admin
    .from("tasks")
    .select("*")

  if (error) {
    console.error("Failed to load tasks", error)
    return { sent: 0, skipped: 0 }
  }

  // your full reminder logic goes here

  return { sent: 0, skipped: 0 }
}