import * as React from "react"
import { Link } from "wouter"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { Mail, Send, CheckCircle, AlertCircle, Paperclip, X, FileText } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { customFetch } from "@workspace/api-client-react"

type Status = "idle" | "loading" | "success" | "error"

// Matches MAX_ATTACHMENTS_BYTES in the api-server route — checked here too
// so the user finds out before uploading/sending, not after.
const MAX_ATTACHMENTS_BYTES = 10 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // readAsDataURL yields "data:<mime>;base64,<data>" — Resend wants
      // just the base64 payload.
      const result = reader.result as string
      resolve(result.slice(result.indexOf(",") + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function SendEmail() {
  const [to, setTo] = React.useState("")
  const [subject, setSubject] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [status, setStatus] = React.useState<Status>("idle")
  const [feedback, setFeedback] = React.useState("")
  const [attachments, setAttachments] = React.useState<File[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const totalAttachmentBytes = attachments.reduce((sum, f) => sum + f.size, 0)

  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = "" // allow re-picking the same file later
    if (picked.length === 0) return

    const existingBytes = attachments.reduce((sum, f) => sum + f.size, 0)
    const newBytes = picked.reduce((sum, f) => sum + f.size, 0)
    if (existingBytes + newBytes > MAX_ATTACHMENTS_BYTES) {
      setStatus("error")
      setFeedback(`Attachments can't exceed ${formatBytes(MAX_ATTACHMENTS_BYTES)} total.`)
      return
    }
    setAttachments((prev) => [...prev, ...picked])
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const { data: adminSettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => customFetch<{ integrations: Array<{ key: string; value: string }> }>("/api/admin/settings"),
    staleTime: 60 * 1000,
  })
  const fromDisplay =
    adminSettings?.integrations.find((f) => f.key === "from_email")?.value || "your configured sender address"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("loading")
    setFeedback("")

    try {
      const encodedAttachments = await Promise.all(
        attachments.map(async (file) => ({
          filename: file.name,
          content: await fileToBase64(file),
        })),
      )

      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, message, attachments: encodedAttachments }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus("error")
        setFeedback(data.error || "Failed to send email.")
      } else {
        setStatus("success")
        setFeedback(`Email sent successfully to ${to}`)
        setTo("")
        setSubject("")
        setMessage("")
        setAttachments([])
      }
    } catch {
      setStatus("error")
      setFeedback("Network error. Please try again.")
    }
  }

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
          <Mail className="h-8 w-8" /> Send Email
        </h1>
        <p className="text-muted-foreground mt-1">
          Compose and send emails to clients from{" "}
          <span className="font-medium text-foreground">{fromDisplay}</span>
        </p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
          {/* Header bar */}
          <div className="p-4 border-b bg-muted/30 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">From:</span>
            {fromDisplay}
          </div>

          <form onSubmit={handleSubmit} className="divide-y">
            {/* To */}
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="text-sm font-medium text-muted-foreground w-16 shrink-0">To</span>
              <input
                type="email"
                value={to}
                onChange={e => setTo(e.target.value)}
                required
                placeholder="recipient@example.com"
                className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Subject */}
            <div className="flex items-center gap-3 px-5 py-3">
              <span className="text-sm font-medium text-muted-foreground w-16 shrink-0">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
                placeholder="Email subject"
                className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Message body */}
            <div className="px-5 py-4">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                rows={12}
                placeholder="Write your message here..."
                className="w-full text-sm bg-transparent focus:outline-none resize-y placeholder:text-muted-foreground/50 leading-relaxed"
              />
            </div>

            {/* Attachments */}
            <div className="px-5 py-4">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFilesPicked}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Paperclip className="h-4 w-4" />
                Attach files or receipts
              </button>

              {attachments.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {attachments.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center gap-2 text-sm bg-muted/40 rounded-md px-3 py-1.5"
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatBytes(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        aria-label={`Remove ${file.name}`}
                        className="text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                  <li className="text-xs text-muted-foreground pt-0.5">
                    {formatBytes(totalAttachmentBytes)} of {formatBytes(MAX_ATTACHMENTS_BYTES)}
                  </li>
                </ul>
              )}
            </div>

            {/* Feedback */}
            {status === "success" && (
              <div className="mx-5 mb-4 flex items-center justify-between gap-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  {feedback}
                </span>
                <Link href="/admin/inbox" className="font-medium underline shrink-0">
                  View in Inbox
                </Link>
              </div>
            )}
            {status === "error" && (
              <div className="mx-5 mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {feedback}
              </div>
            )}

            {/* Actions */}
            <div className="px-5 py-4 bg-muted/20 flex items-center justify-between">
              <button
                type="submit"
                disabled={status === "loading"}
                className="flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-2.5 rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
                {status === "loading" ? "Sending…" : "Send Email"}
              </button>
              <span className="text-xs text-muted-foreground">
                Sent via Resend · veyloraglobal.online
              </span>
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  )
}
