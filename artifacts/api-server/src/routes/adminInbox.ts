import { Router } from "express";
import { db, emailsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { sendEmail, getFromAddress } from "../lib/resend";

const router = Router();

function requireAuth(req: import("express").Request, res: import("express").Response): boolean {
  if (!req.session.userName) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

// GET /api/admin/inbox — one row per thread (external counterpart
// address), with the latest message's preview and an unread count.
router.get("/admin/inbox", async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const rows = await db.select().from(emailsTable).orderBy(desc(emailsTable.createdAt));

    const threads = new Map<
      string,
      {
        threadId: string;
        counterpart: string;
        latestSubject: string;
        latestPreview: string;
        latestAt: string;
        unreadCount: number;
        messageCount: number;
        hasInbound: boolean;
        hasOutbound: boolean;
        sentSubject: string | null;
        sentPreview: string | null;
        sentAt: string | null;
        sentCount: number;
      }
    >();

    const previewOf = (row: (typeof rows)[number]) =>
      (row.textBody || row.htmlBody.replace(/<[^>]+>/g, " ")).slice(0, 140);

    for (const row of rows) {
      const existing = threads.get(row.threadId);
      const isUnread = row.direction === "inbound" && !row.isRead;
      const isOut = row.direction === "outbound";
      if (!existing) {
        threads.set(row.threadId, {
          threadId: row.threadId,
          counterpart: row.direction === "inbound" ? row.fromAddress : row.toAddress,
          latestSubject: row.subject,
          latestPreview: (row.textBody || row.htmlBody.replace(/<[^>]+>/g, " ")).slice(0, 140),
          latestAt: row.createdAt.toISOString(),
          unreadCount: isUnread ? 1 : 0,
          messageCount: 1,
          hasInbound: row.direction === "inbound",
          hasOutbound: isOut,
          // Rows are newest-first, so the first outbound row seen per
          // thread is the most recent email sent to that address.
          sentSubject: isOut ? row.subject : null,
          sentPreview: isOut ? previewOf(row) : null,
          sentAt: isOut ? row.createdAt.toISOString() : null,
          sentCount: isOut ? 1 : 0,
        });
      } else {
        existing.messageCount += 1;
        if (isUnread) existing.unreadCount += 1;
        if (row.direction === "inbound") existing.hasInbound = true;
        if (isOut) {
          existing.hasOutbound = true;
          existing.sentCount += 1;
          if (!existing.sentAt) {
            existing.sentSubject = row.subject;
            existing.sentPreview = previewOf(row);
            existing.sentAt = row.createdAt.toISOString();
          }
        }
      }
    }

    res.json({ threads: Array.from(threads.values()) });
  } catch (err) {
    req.log.error({ err }, "Failed to load inbox");
    res.status(500).json({ error: "Failed to load inbox" });
  }
});

// GET /api/admin/inbox/threads/:threadId — full message list for one
// thread, oldest first. Marks inbound messages in it as read.
router.get("/admin/inbox/threads/:threadId", async (req, res) => {
  if (!requireAuth(req, res)) return;

  const threadId = decodeURIComponent(req.params.threadId).toLowerCase().trim();

  try {
    const messages = await db
      .select()
      .from(emailsTable)
      .where(eq(emailsTable.threadId, threadId))
      .orderBy(emailsTable.createdAt);

    if (messages.length === 0) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    await db
      .update(emailsTable)
      .set({ isRead: true })
      .where(and(eq(emailsTable.threadId, threadId), eq(emailsTable.direction, "inbound")));

    res.json({ threadId, counterpart: messages[0]!.direction === "inbound" ? messages[0]!.fromAddress : messages[0]!.toAddress, messages });
  } catch (err) {
    req.log.error({ err }, "Failed to load thread");
    res.status(500).json({ error: "Failed to load thread" });
  }
});

// POST /api/admin/inbox/threads/:threadId/reply — sends an email to the
// thread's counterpart via the configured Resend account and logs it as
// an outbound message in the same thread.
router.post("/admin/inbox/threads/:threadId/reply", async (req, res) => {
  if (!requireAuth(req, res)) return;

  const threadId = decodeURIComponent(req.params.threadId).toLowerCase().trim();
  const { subject, message } = req.body as { subject?: string; message?: string };

  if (!message || !message.trim()) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  try {
    const [latest] = await db
      .select()
      .from(emailsTable)
      .where(eq(emailsTable.threadId, threadId))
      .orderBy(desc(emailsTable.createdAt))
      .limit(1);

    if (!latest) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    const counterpart = latest.direction === "inbound" ? latest.fromAddress : latest.toAddress;
    const replySubject = subject?.trim() || (latest.subject.toLowerCase().startsWith("re:") ? latest.subject : `Re: ${latest.subject}`);

    const html = `
      <div style="font-family:sans-serif;max-width:620px;margin:0 auto;color:#1a1a2e">
        <div style="background:#1a1a2e;padding:24px 32px;border-radius:8px 8px 0 0">
          <h2 style="color:#ffffff;margin:0;font-size:20px">Veylora Global</h2>
        </div>
        <div style="background:#ffffff;padding:32px;border:1px solid #e5e7eb;border-top:none;line-height:1.7;font-size:15px;color:#374151;white-space:pre-wrap">${message}</div>
      </div>
    `;

    await sendEmail(counterpart, replySubject, html);
    const fromAddress = await getFromAddress();

    const [inserted] = await db
      .insert(emailsTable)
      .values({
        direction: "outbound",
        fromAddress,
        toAddress: counterpart,
        subject: replySubject,
        textBody: message,
        htmlBody: html,
        messageId: "",
        threadId,
        isRead: true,
      })
      .returning();

    req.log.info({ to: counterpart, sentBy: req.session.userName }, "Inbox reply sent");
    res.json({ success: true, message: inserted });
  } catch (err) {
    req.log.error({ err }, "Failed to send inbox reply");
    res.status(500).json({ error: "Failed to send reply. Please try again." });
  }
});

export default router;
