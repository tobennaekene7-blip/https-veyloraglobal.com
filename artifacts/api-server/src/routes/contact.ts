import { Router } from "express";
import { sendEmail } from "../lib/resend";

const router = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "support@veyloraglobal.online";

// POST /api/contact
router.post("/contact", async (req, res) => {
  const { name, email, subject, message } = req.body as {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  };

  if (!name || !email || !subject || !message) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  try {
    // 1. Notify admin
    await sendEmail(
      ADMIN_EMAIL,
      `New Contact Form: ${subject}`,
      `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e">
          <div style="background:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0">
            <h2 style="color:#ffffff;margin:0;font-size:20px">📬 New Contact Form Submission</h2>
          </div>
          <div style="background:#f9f9f9;padding:32px;border:1px solid #e5e7eb;border-top:none">
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:100px">Name</td><td style="padding:8px 0;font-weight:600">${name}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Email</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#e67e22">${email}</a></td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Subject</td><td style="padding:8px 0;font-weight:600">${subject}</td></tr>
            </table>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
            <p style="color:#6b7280;font-size:14px;margin:0 0 8px">Message:</p>
            <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:6px;padding:16px;font-size:15px;line-height:1.6;white-space:pre-wrap">${message}</div>
            <div style="margin-top:24px">
              <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}" style="background:#e67e22;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">Reply to ${name}</a>
            </div>
          </div>
          <div style="background:#f3f4f6;padding:16px 32px;border-radius:0 0 8px 8px;font-size:12px;color:#9ca3af;border:1px solid #e5e7eb;border-top:none">
            Sent from the contact form at veyloraglobal.online
          </div>
        </div>
      `
    );

    // 2. Auto-reply to customer
    await sendEmail(
      email,
      `We received your message — Veylora Global`,
      `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e">
          <div style="background:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0">
            <h2 style="color:#ffffff;margin:0;font-size:20px">Veylora Global</h2>
            <p style="color:#9ca3af;margin:4px 0 0;font-size:14px">Fast. Reliable. Everywhere.</p>
          </div>
          <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none">
            <h3 style="margin:0 0 16px;font-size:18px">Hi ${name},</h3>
            <p style="line-height:1.6;color:#374151">Thank you for contacting us. We've received your message and a member of our support team will get back to you within <strong>24 hours</strong>.</p>
            <div style="background:#f9f9f9;border-left:4px solid #e67e22;border-radius:0 6px 6px 0;padding:16px 20px;margin:24px 0">
              <p style="margin:0 0 4px;font-size:13px;color:#6b7280;font-weight:600">YOUR MESSAGE</p>
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.6"><em>${subject}</em></p>
            </div>
            <p style="line-height:1.6;color:#374151">In the meantime, you can track your shipments at:<br/>
              <a href="https://veyloraglobal.online/track" style="color:#e67e22;font-weight:600">veyloraglobal.online/track</a>
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
            <p style="font-size:13px;color:#6b7280;margin:0">📞 +1 (800) 555-0199 &nbsp;|&nbsp; 📧 support@veyloraglobal.online</p>
          </div>
          <div style="background:#f3f4f6;padding:16px 32px;border-radius:0 0 8px 8px;font-size:12px;color:#9ca3af;border:1px solid #e5e7eb;border-top:none;text-align:center">
            © 2024 Veylora Global. All rights reserved.
          </div>
        </div>
      `
    );

    req.log.info({ name, email, subject }, "Contact form email sent");
    res.json({ message: "Your message has been received. We will get back to you shortly." });
  } catch (err) {
    req.log.error({ err }, "Failed to send contact email");
    // Still return success to customer — don't expose internal errors
    res.json({ message: "Your message has been received. We will get back to you shortly." });
  }
});

export default router;
