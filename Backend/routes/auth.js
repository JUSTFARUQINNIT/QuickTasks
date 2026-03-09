import express from "express"
import { admin } from "../utils/supabase.js"
import { mailTransport } from "../utils/mailer.js"

const router = express.Router()

const APP_URL = process.env.APP_URL ?? "http://localhost:5173/"

router.post("/request-password-reset", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "").trim().toLowerCase()

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Invalid email." })
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: APP_URL }
    })

    if (error) {
      console.log("Error:", error)
      return res.status(500).json({ error: error.message })
    }

    const actionLink = data?.properties?.action_link

    if (!actionLink) {
      return res.status(500).json({ error: "Could not generate reset link." })
    }

    const from = process.env.MAIL_FROM ?? "QuickTasks <quicktalkassist@gmail.com>"

    const html = `
      <h2>Reset your password</h2>
      <p>Click the button below to reset your password</p>
      <a href="${actionLink}">Reset Password</a>
    `

    await mailTransport.sendMail({
      from,
      to: email,
      subject: "Reset your QuickTasks password",
      html
    })

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router