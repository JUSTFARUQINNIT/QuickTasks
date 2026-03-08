import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

const PORT = Number(process.env.PORT ?? 8787)
const API_URL = process.env.VITE_API_URL ?? 'https://quicktasks-backend-wqb3.onrender.com'
const APP_URL = process.env.APP_URL ?? 'https://quick-tasks-eight.vercel.app/'
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[QuickTasks server] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Password reset emails will not work.')
}

const admin = createClient(SUPABASE_URL ?? '', SUPABASE_SERVICE_ROLE_KEY ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
})

const mailUser = process.env.EMAIL_USER
const mailPass = process.env.EMAIL_PASS

const mailTransport =
  mailUser && mailPass
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: mailUser,
          pass: mailPass,
        },
      })
    : null

const app = express()
app.use(express.json())

// ======================
// CORS CONFIGURATION
// ======================
const allowedOrigins = [APP_URL, 'https://quick-tasks-eight.vercel.app/']
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true) // allow non-browser clients
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error(`CORS policy: origin ${origin} not allowed`), false)
    }
    return callback(null, true)
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

// Handle preflight OPTIONS requests
app.options('*', cors({
  origin: allowedOrigins,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))

// ======================
// HEALTH CHECK
// ======================

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})


// ======================
// PASSWORD RESET
// ======================
app.post('/api/auth/request-password-reset', async (req, res) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Invalid email.' })
      return
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      res.status(500).json({ error: 'Server is not configured.' })
      return
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: APP_URL },
    })

    if (error) {
      res.status(500).json({ error: error.message })
      console.log('Error:', error)
      return
    }

    const actionLink = data?.properties?.action_link
    if (!actionLink) {
      res.status(500).json({ error: 'Could not generate reset link.' })
      console.log('Could not generate reset link.', actionLink)
      console.log('Error:', error)
      return
    }       

    const from = process.env.MAIL_FROM ?? 'QuickTasks <quicktalkassist@gmail.com>'
    const subject = 'Reset your QuickTasks password'
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Reset your password</h2>
        <p style="margin:0 0 12px">Click the button below to choose a new password.</p>
        <p style="margin:18px 0">
          <a href="${actionLink}" style="background:#7ed957;color:#ffffff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:700;display:inline-block">
            Reset password
          </a>
        </p>
        <p style="margin:0;color:#475569;font-size:12px">
          If you didn’t request this, you can safely ignore this email.
        </p>
      </div>
    `

    if (!mailTransport) {
      console.log('[QuickTasks server] SMTP not configured. Reset link:', actionLink)
      res.json({ ok: true, delivered: false })
      return
    }

    await mailTransport.sendMail({ from, to: email, subject, html })
    res.json({ ok: true, delivered: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
})

// ======================
// DAILY REMINDERS
// ======================


async function sendDailyReminderEmails() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[QuickTasks server] Supabase not configured; cannot send reminders.')
    return { sent: 0, skipped: 0 }
  }

  if (!mailTransport) {
    console.warn('[QuickTasks server] SMTP not configured; skipping reminder emails.')
    return { sent: 0, skipped: 0 }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const inSeven = new Date(today)
  inSeven.setDate(inSeven.getDate() + 7)
  const inSevenStr = inSeven.toISOString().slice(0, 10)

  // Fetch all tasks due in the next 7 days that are not completed.
  const { data: tasks, error: tasksError } = await admin
    .from('tasks')
    .select('id,user_id,title,due_date,completed')
    .eq('completed', false)
    .not('due_date', 'is', null)
    .gte('due_date', todayStr)
    .lte('due_date', inSevenStr)

  if (tasksError) {
    console.error('[QuickTasks server] Failed to load tasks for reminders:', tasksError)
    return { sent: 0, skipped: 0 }
  }

  if (!tasks || tasks.length === 0) {
    return { sent: 0, skipped: 0 }
  }

  const userIds = Array.from(new Set(tasks.map((t) => t.user_id)))

  // Fetch profiles for those users to get email + email-reminder preference.
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id,email,username,notification_email,notifications_enabled')
    .in('id', userIds)

  if (profilesError) {
    console.error('[QuickTasks server] Failed to load profiles for reminders:', profilesError)
    return { sent: 0, skipped: 0 }
  }

  // Fetch existing send logs so we only send once per user per day, if the table exists.
  let alreadySent = new Set()
  let logTableAvailable = true
  const { data: logs, error: logsError } = await admin
    .from('reminder_email_sends')
    .select('user_id')
    .eq('sent_date', todayStr)
    .in('user_id', userIds)

  if (logsError) {
    const msg = String(logsError.message ?? logsError)
    if (msg.includes('reminder_email_sends')) {
      // Migration not applied yet; continue without per-day dedup table.
      logTableAvailable = false
      console.warn('[QuickTasks server] reminder_email_sends table missing; daily dedup disabled.')
    } else {
      console.error('[QuickTasks server] Failed to read reminder_email_sends:', logsError)
    }
  } else if (logs && logs.length > 0) {
    alreadySent = new Set(logs.map((row) => row.user_id))
  }

  // Group tasks by user
  const tasksByUser = new Map()
  for (const task of tasks) {
    if (!task.due_date) continue
    const list = tasksByUser.get(task.user_id) ?? []
    list.push(task)
    tasksByUser.set(task.user_id, list)
  }

  let sent = 0
  let skipped = 0

  for (const profile of profiles ?? []) {
    const userId = profile.id
    const email = profile.email
    const prefersEmail = profile.notification_email === true || profile.notifications_enabled === true
    const userTasks = tasksByUser.get(userId) ?? []

    if (!email || !prefersEmail || userTasks.length === 0) {
      skipped += 1
      continue
    }

    if (logTableAvailable && alreadySent.has(userId)) {
      skipped += 1
      continue
    }

    const displayName = profile.username || email.split('@')[0] || 'there'

    const itemsHtml = userTasks
      .map((t) => {
        const due = new Date(t.due_date)
        const dueStr = due.toLocaleDateString('en-US', { dateStyle: 'medium' })
        return `<li><strong>${t.title ?? 'Task'}</strong> — due ${dueStr}</li>`
      })
      .join('')

    const from = process.env.MAIL_FROM ?? 'QuickTasks <quicktalkassist@gmail.com>'
    const subject = 'QuickTasks – upcoming task deadlines'
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Hi ${displayName}, here are your upcoming tasks</h2>
        <p style="margin:0 0 12px">These tasks are due within the next 7 days:</p>
        <ul style="margin:0 0 16px;padding-left:20px">${itemsHtml}</ul>
        <p style="margin:0 0 12px">
          You can view and manage them in your dashboard.
        </p>
        <p style="margin:0;color:#475569;font-size:12px">
          You received this email because email reminders are enabled in your QuickTasks profile.
        </p>
      </div>
    `

    try {
      await mailTransport.sendMail({ from, to: email, subject, html })
      sent += 1

      if (logTableAvailable) {
        const { error: insertError } = await admin.from('reminder_email_sends').insert({
          user_id: userId,
          sent_date: todayStr,
        })
        if (insertError) {
          const msg = String(insertError.message ?? insertError)
          // Ignore duplicate insert errors; anything else should be logged.
          if (!msg.toLowerCase().includes('duplicate')) {
            console.error('[QuickTasks server] Failed to log reminder send:', insertError)
          }
        }
      }
    } catch (err) {
      skipped += 1
      console.error('[QuickTasks server] Failed to send reminder email:', err)
    }
  }

  console.log(`[QuickTasks server] Daily reminder emails: sent=${sent}, skipped=${skipped}`)
  return { sent, skipped }
}


// ======================
// CRON ENDPOINT
// ======================

app.post('/api/reminders/send-daily', async (req, res) => {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const header = req.headers['x-cron-secret']
      if (header !== cronSecret) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
    }

    const result = await sendDailyReminderEmails()
    res.json({ ok: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[QuickTasks server] Error while sending daily reminders:', e)
    res.status(500).json({ error: message })
  }
})

app.listen(PORT, () => {
  console.log(`[QuickTasks server] listening on ${PORT}`)

  // Optional: fire-and-forget daily reminders once on server start.
  // In production, prefer calling /api/reminders/send-daily from an external cron.
  void sendDailyReminderEmails()
})

