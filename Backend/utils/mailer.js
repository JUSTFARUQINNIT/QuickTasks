import brevo from "@getbrevo/brevo";

const apiInstance = new brevo.TransactionalEmailsApi();

const API_KEY = process.env.BREVO_API_KEY ?? "";

if (API_KEY) {
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, API_KEY);
} else {
  // This will surface clearly in logs on environments where the key is missing
  console.error(
    "BREVO_API_KEY is not set. Email sending will fail until this is configured.",
  );
}

const DEFAULT_SENDER_EMAIL =
  process.env.MAIL_FROM_EMAIL ?? process.env.EMAIL_USER ?? "";
const DEFAULT_SENDER_NAME = process.env.MAIL_FROM_NAME ?? "QuickTasks";

function resolveSender(from) {
  // If a custom "from" is provided, try to parse `Name <email@example.com>`
  if (from) {
    try {
      const raw = String(from).trim();

      // Pattern: Name <email@example.com>
      const match = raw.match(/^(.*)<(.+)>$/);
      if (match) {
        const name = match[1].trim().replace(/^"|"$/g, "");
        const email = match[2].trim();
        if (email.includes("@")) {
          return { email, name: name || DEFAULT_SENDER_NAME };
        }
      }

      // Fallback: if it just looks like an email
      if (raw.includes("@")) {
        return { email: raw, name: DEFAULT_SENDER_NAME };
      }
    } catch {
      // Fall through to default sender
    }
  }

  if (!DEFAULT_SENDER_EMAIL) {
    console.error(
      "No default sender email configured. Set MAIL_FROM_EMAIL or EMAIL_USER.",
    );
  }

  return {
    email: DEFAULT_SENDER_EMAIL || "no-reply@example.com",
    name: DEFAULT_SENDER_NAME,
  };
}

function normalizeRecipients(to) {
  if (Array.isArray(to)) {
    return to
      .map((entry) => {
        if (typeof entry === "string") {
          return { email: entry };
        }
        if (entry && typeof entry.email === "string") {
          return { email: entry.email, name: entry.name };
        }
        return null;
      })
      .filter((x) => x && x.email && x.email.includes("@"));
  }

  const email = String(to ?? "").trim();
  if (!email || !email.includes("@")) {
    return [];
  }

  return [{ email }];
}

export const mailTransport = {
  /**
   * Minimal sendMail-compatible wrapper so existing routes can keep using
   * `mailTransport.sendMail({ from, to, subject, html })`.
   */
  async sendMail({ from, to, subject, html, text }) {
    if (!API_KEY) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    const sender = resolveSender(from);
    const recipients = normalizeRecipients(to);

    if (!recipients.length) {
      throw new Error("No valid recipient email provided");
    }

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = subject ?? "";
    sendSmtpEmail.htmlContent = html ?? "";
    if (text) {
      sendSmtpEmail.textContent = text;
    }
    sendSmtpEmail.sender = sender;
    sendSmtpEmail.to = recipients;

    return apiInstance.sendTransacEmail(sendSmtpEmail);
  },
};
