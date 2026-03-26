import express from "express";
import { mailTransport } from "../utils/mailer.js";

const router = express.Router();

// POST /api/contact - Handle contact form submissions
router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message, company } = req.body;

    console.log("📧 Contact form submission:", { name, email, subject });

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: "Please fill in all required fields",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Please provide a valid email address",
      });
    }

    // Prepare email content
    const emailContent = `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0b1120 0, #020617 45%, #000 100%); padding: 30px; border-radius: 16px; color: #e5e7eb;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://quick-tasks-ochre.vercel.app/quicktasks-logo.svg" alt="QuickTasks" style="width: 28px; height: 28px; margin-bottom: 10px;">
            <h1 style="color: #78d957; margin: 0; font-size: 24px; font-weight: 600;">QuickTasks</h1>
            <p style="margin: 5px 0 0; color: #9ca3af; font-size: 14px;">New Contact Form Submission</p>
          </div>
          
          <div style="background: rgba(148, 163, 184, 0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h2 style="color: #78d957; margin: 0 0 20px; font-size: 18px; font-family: 'Poppins', sans-serif;">Contact Information</h2>
            <div style="display: grid; gap: 12px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #9ca3af; min-width: 80px; font-family: 'Poppins', sans-serif;">Name:</span>
                <span style="color: #e5e7eb; font-weight: 500; font-family: 'Poppins', sans-serif;">${name}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #9ca3af; min-width: 80px; font-family: 'Poppins', sans-serif;">Email:</span>
                <span style="color: #e5e7eb; font-weight: 500; font-family: 'Poppins', sans-serif;">${email}</span>
              </div>
              ${
                company
                  ? `
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #9ca3af; min-width: 80px; font-family: 'Poppins', sans-serif;">Company:</span>
                <span style="color: #e5e7eb; font-weight: 500; font-family: 'Poppins', sans-serif;">${company}</span>
              </div>
              `
                  : ""
              }
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="color: #9ca3af; min-width: 80px; font-family: 'Poppins', sans-serif;">Subject:</span>
                <span style="color: #e5e7eb; font-weight: 500; font-family: 'Poppins', sans-serif;">${subject}</span>
              </div>
            </div>
          </div>
          
          <div style="background: rgba(148, 163, 184, 0.1); padding: 20px; border-radius: 12px;">
            <h2 style="color: #78d957; margin: 0 0 20px; font-size: 18px; font-family: 'Poppins', sans-serif;">Message</h2>
            <div style="color: #e5e7eb; line-height: 1.6; white-space: pre-wrap; font-family: 'Poppins', sans-serif;">${message}</div>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(148, 163, 184, 0.3); text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; font-family: 'Poppins', sans-serif;">
              This message was sent from the QuickTasks contact form at ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    `;

    // Send email to QuickTasks
    const mailOptions = {
      from: `"QuickTasks Contact Form" <${process.env.MAIL_FROM_EMAIL || "quicktalkassist@gmail.com"}>`,
      to: "quicktalkassist@gmail.com", // QuickTasks email
      subject: `New Contact Form: ${subject}`,
      html: emailContent,
    };

    console.log("📤 Sending email to QuickTasks...");
    await mailTransport.sendMail(mailOptions);
    console.log("✅ Email sent successfully!");

    // Send confirmation email to user
    const confirmationEmail = `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0b1120 0, #020617 45%, #000 100%); padding: 30px; border-radius: 16px; color: #e5e7eb;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://quick-tasks-ochre.vercel.app/quicktasks-logo.svg" alt="QuickTasks" style="width: 28px; height: 28px; margin-bottom: 10px;">
            <h1 style="color: #78d957; margin: 0; font-size: 24px; font-weight: 600; font-family: 'Poppins', sans-serif;">QuickTasks</h1>
            <p style="margin: 5px 0 0; color: #9ca3af; font-size: 14px; font-family: 'Poppins', sans-serif;">Thank you for contacting us!</p>
          </div>
          
          <div style="background: rgba(148, 163, 184, 0.1); padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h2 style="color: #78d957; margin: 0 0 15px; font-size: 18px; font-family: 'Poppins', sans-serif;">Message Received</h2>
            <p style="color: #e5e7eb; line-height: 1.6; margin: 0; font-family: 'Poppins', sans-serif;">
              Hi ${name},<br><br>
              We've received your message regarding "<strong>${subject}</strong>" and our team will get back to you within 24 hours.
            </p>
          </div>
          
          <div style="background: rgba(148, 163, 184, 0.1); padding: 20px; border-radius: 12px;">
            <h3 style="color: #78d957; margin: 0 0 15px; font-size: 16px; font-family: 'Poppins', sans-serif;">What happens next?</h3>
            <ul style="color: #e5e7eb; line-height: 1.6; margin: 0; padding-left: 20px; font-family: 'Poppins', sans-serif;">
              <li>Our support team reviews your message</li>
              <li>We'll respond within 24 hours</li>
              <li>You'll receive a personalized reply at ${email}</li>
            </ul>
          </div>
          
          <div style="margin-top: 30px; text-align: center;">
            <a href="https://quick-tasks-ochre.vercel.app/" style="background: #78d957; color: #052e16; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-family: 'Poppins', sans-serif;">
              Visit QuickTasks
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(148, 163, 184, 0.3); text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0; font-family: 'Poppins', sans-serif;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
    `;

    const confirmationMailOptions = {
      from: `"QuickTasks" <${process.env.MAIL_FROM_EMAIL || "quicktalkassist@gmail.com"}>`,
      to: email,
      subject: "Thank you for contacting QuickTasks",
      html: confirmationEmail,
    };

    console.log("📤 Sending confirmation email to user...");
    await mailTransport.sendMail(confirmationMailOptions);
    console.log("✅ Confirmation email sent successfully!");

    res.status(200).json({
      success: true,
      message:
        "Your message has been sent successfully! We'll get back to you within 24 hours.",
    });
  } catch (error) {
    console.error("❌ Error sending contact form email:", error);

    // More detailed error message for debugging
    let errorMessage = "Failed to send message. Please try again later.";

    if (error.message && error.message.includes("BREVO_API_KEY")) {
      errorMessage =
        "Email service not configured properly. Please contact support.";
    } else if (error.message && error.message.includes("No valid recipient")) {
      errorMessage = "Invalid email address provided.";
    }

    res.status(500).json({
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/contact - Health check endpoint
router.get("/", (req, res) => {
  res.json({
    status: "Contact form API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
