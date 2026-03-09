import nodemailer from "nodemailer"

const mailUser = process.env.EMAIL_USER
const mailPass = process.env.EMAIL_PASS

export const mailTransport = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  family: 4,
  auth: {
    user: mailUser,
    pass: mailPass
  }
})