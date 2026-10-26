import { Router } from "express";
import { sendEmail, getFromAddress, type EmailAttachment } from "../lib/resend";
import { db, emailsTable } from "@workspace/db";

const router = Router();

// Resend's own per-email cap is well above this, but base64 inflates size
// by ~33% and this travels inside one JSON request body (see the 15mb
// express.json limit in app.ts) — 10mb of actual attachment content is a
// generous ceiling for the receipts/photos/small PDFs this is meant for.
const MAX_ATTACHMENTS_BYTES = 10 * 1024 * 1024;

// POST /api/admin/send-email  (auth-protected)
router.post("/admin/send-email", async (req, res) => {
  if (!req.session.userName) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { to, subject, message, attachments } = req.body as {
    to?: string;
    subject?: string;
    message?: string;
    attachments?: EmailAttachment[];
  };

  if (!to || !subject || !message) {
    res.status(400).json({ error: "To, subject, and message are required" });
    return;
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    res.status(400).json({ error: "Invalid recipient email address" });
    return;
  }

  let cleanAttachments: EmailAttachment[] | undefined;
  if (attachments !== undefined) {
    if (
      !Array.isArray(attachments) ||
      attachments.some(
        (a) => typeof a?.filename !== "string" || !a.filename.trim() || typeof a?.content !== "string",
      )
    ) {
      res.status(400).json({ error: "Attachments are malformed" });
      return;
    }
    const totalBytes = attachments.reduce((sum, a) => sum + Math.ceil((a.content.length * 3) / 4), 0);
    if (totalBytes > MAX_ATTACHMENTS_BYTES) {
      res.status(400).json({ error: "Attachments are too large — 10MB total limit" });
      return;
    }
    cleanAttachments = attachments;
  }

  try {
    const html = `
      <div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#1a1a2e">
        <div style="background:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0">
          <h2 style="color:#ffffff;margin:0;font-size:20px">Veylora Global</h2>
          <p style="color:#9ca3af;margin:4px 0 0;font-size:13px">Fast. Reliable. Everywhere.</p>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;line-height:1.7;font-size:15px;color:#374151;white-space:pre-wrap">${message}</div>
        <div style="background:#f3f4f6;padding:16px 32px;border-radius:0 0 8px 8px;font-size:12px;color:#9ca3af;border:1px solid #e5e7eb;border-top:none;text-align:center">
          📞 +1 (800) 555-0199 &nbsp;|&nbsp; 📧 support@veyloraglobal.online<br/>
          © 2024 Veylora Global. All rights reserved.
        </div>
      </div>
    `;

    await sendEmail(to, subject, html, cleanAttachments);

    const attachmentNote =
      cleanAttachments && cleanAttachments.length > 0
        ? `\n\n[Attached: ${cleanAttachments.map((a) => a.filename).join(", ")}]`
        : "";

    // Log it the same way an inbox reply is logged, so it shows up as a
    // thread in Admin → Inbox (previously this route sent via Resend but
    // never recorded anything — a sent email vanished with no way to see
    // it was sent, and no "Sent" view existed anywhere in the admin).
    // threadId is keyed by the counterpart's address (lowercased/trimmed),
    // matching the convention the inbound webhook uses, so a future reply
    // from this recipient lands in the same thread instead of a new one.
    const fromAddress = await getFromAddress();
    try {
      await db.insert(emailsTable).values({
        direction: "outbound",
        fromAddress,
        toAddress: to,
        subject,
        textBody: message + attachmentNote,
        htmlBody: html,
        messageId: "",
        threadId: to.toLowerCase().trim(),
        isRead: true,
      });
    } catch (logErr) {
      // The email itself already sent successfully — don't fail the
      // request just because the inbox log insert hiccupped.
      req.log.error({ err: logErr }, "Sent email but failed to log it to the inbox");
    }

    req.log.info({ to, subject, sentBy: req.session.userName }, "Admin email sent");
    res.json({ success: true, message: `Email sent to ${to}` });
  } catch (err) {
    req.log.error({ err }, "Failed to send admin email");
    res.status(500).json({ error: "Failed to send email. Please try again." });
  }
});

export default router;
