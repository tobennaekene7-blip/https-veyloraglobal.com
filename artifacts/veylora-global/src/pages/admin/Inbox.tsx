import * as React from "react"
import { AdminLayout } from "@/components/layout/AdminLayout"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { customFetch } from "@workspace/api-client-react"
import { Inbox as InboxIcon, Send, ArrowLeft, Mail, MailOpen, Loader2, AlertCircle } from "lucide-react"

interface InboxThread {
  threadId: string
  counterpart: string
  latestSubject: string
  latestPreview: string
  latestAt: string
  unreadCount: number
  messageCount: number
  hasInbound: boolean
  hasOutbound: boolean
  sentSubject: string | null
  sentPreview: string | null
  sentAt: string | null
  sentCount: number
}

interface EmailMessage {
  id: number
  direction: "inbound" | "outbound"
  fromAddress: string
  toAddress: string
  subject: string
  textBody: string
  htmlBody: string
  createdAt: string
}

interface ThreadDetail {
  threadId: string
  counterpart: string
  messages: EmailMessage[]
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function Inbox() {
  const queryClient = useQueryClient()
  const [selectedThread, setSelectedThread] = React.useState<string | null>(null)
  const [replyText, setReplyText] = React.useState("")
  // "inbox" = threads that have at least one message a customer sent in.
  // "sent" = every address you've emailed (Send Email or an inbox reply),
  // newest send first. A thread can appear in both tabs once the other
  // side replies — sent mail never disappears from the Sent tab.
  const [tab, setTab] = React.useState<"inbox" | "sent">("inbox")

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-inbox"],
    queryFn: () => customFetch<{ threads: InboxThread[] }>("/api/admin/inbox"),
    refetchInterval: 30_000,
  })

  const { data: thread, isLoading: threadLoading } = useQuery({
    queryKey: ["admin-inbox-thread", selectedThread],
    queryFn: () =>
      customFetch<ThreadDetail>(`/api/admin/inbox/threads/${encodeURIComponent(selectedThread!)}`),
    enabled: !!selectedThread,
  })

  const replyMutation = useMutation({
    mutationFn: (message: string) =>
      customFetch(`/api/admin/inbox/threads/${encodeURIComponent(selectedThread!)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => {
      setReplyText("")
      queryClient.invalidateQueries({ queryKey: ["admin-inbox-thread", selectedThread] })
      queryClient.invalidateQueries({ queryKey: ["admin-inbox"] })
      queryClient.invalidateQueries({ queryKey: ["admin-inbox-unread-badge"] })
    },
  })

  React.useEffect(() => {
    if (selectedThread) {
      queryClient.invalidateQueries({ queryKey: ["admin-inbox"] })
      queryClient.invalidateQueries({ queryKey: ["admin-inbox-unread-badge"] })
    }
  }, [selectedThread, thread?.messages.length])

  const handleReply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim()) return
    replyMutation.mutate(replyText)
  }

  const allThreads = data?.threads ?? []
  const inboxThreads = allThreads.filter((t) => t.hasInbound)
  const sentThreads = allThreads
    .filter((t) => t.hasOutbound && t.sentAt)
    .sort((a, b) => new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime())
  const threads = tab === "inbox" ? inboxThreads : sentThreads

  const switchTab = (next: "inbox" | "sent") => {
    setTab(next)
    setSelectedThread(null)
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
          <InboxIcon className="h-8 w-8" /> Inbox
        </h1>
        <p className="text-muted-foreground mt-1">
          Emails sent to your connected mailbox, and emails you send from{" "}
          <span className="font-medium text-foreground">Send Email</span>, both appear here automatically.
        </p>
      </div>

      <div className="flex gap-1 mb-4 border-b">
        <button
          onClick={() => switchTab("inbox")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "inbox"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <InboxIcon className="h-4 w-4" />
          Inbox
          {inboxThreads.length > 0 && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{inboxThreads.length}</span>
          )}
        </button>
        <button
          onClick={() => switchTab("sent")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "sent"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Send className="h-4 w-4" />
          Sent
          {sentThreads.length > 0 && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded-full">{sentThreads.length}</span>
          )}
        </button>
      </div>

      <div className="bg-card border rounded-xl shadow-sm overflow-hidden flex h-[calc(100vh-17rem)] min-h-[380px]">
        {/* Thread list — hidden on mobile once a thread is open */}
        <div className={`w-full md:w-80 shrink-0 border-r overflow-y-auto ${selectedThread ? "hidden md:block" : "block"}`}>
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : isError ? (
            <div className="p-4 text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Failed to load inbox.
            </div>
          ) : threads.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {tab === "sent" ? (
                <>
                  Nothing sent yet. Emails you send from{" "}
                  <span className="font-medium text-foreground">Send Email</span>, or as a reply here in
                  the Inbox, show up in this tab.
                </>
              ) : (
                <>
                  No messages yet. Once your receiving mailbox is connected in{" "}
                  <span className="font-medium text-foreground">Settings → Integrations</span>, incoming
                  emails will show up here.
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y">
              {threads.map((t) => {
                const isSentTab = tab === "sent"
                const subject = isSentTab ? t.sentSubject ?? t.latestSubject : t.latestSubject
                const preview = isSentTab ? t.sentPreview ?? t.latestPreview : t.latestPreview
                const at = isSentTab ? t.sentAt ?? t.latestAt : t.latestAt
                const showUnread = !isSentTab && t.unreadCount > 0
                return (
                <li key={t.threadId}>
                  <button
                    onClick={() => setSelectedThread(t.threadId)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                      selectedThread === t.threadId ? "bg-muted/60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${showUnread ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                        {isSentTab ? `To: ${t.counterpart}` : t.counterpart}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">{timeAgo(at)}</span>
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${showUnread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {subject}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{preview}</p>
                    {isSentTab && t.sentCount > 1 && (
                      <span className="inline-block mt-1 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                        {t.sentCount} sent
                      </span>
                    )}
                    {showUnread && (
                      <span className="inline-block mt-1 text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full font-bold">
                        {t.unreadCount} new
                      </span>
                    )}
                  </button>
                </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Thread detail — hidden on mobile until a thread is selected */}
        <div className={`flex-1 flex flex-col min-w-0 ${selectedThread ? "flex" : "hidden md:flex"}`}>
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation to view it.
            </div>
          ) : threadLoading || !thread || !Array.isArray(thread.messages) ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="p-4 border-b flex items-center gap-3">
                <button
                  onClick={() => setSelectedThread(null)}
                  className="md:hidden p-1 -ml-1 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">{thread.counterpart}</p>
                  <p className="text-xs text-muted-foreground truncate">{thread.messages[thread.messages.length - 1]?.subject}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {thread.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-xl px-4 py-3 ${
                      m.direction === "outbound"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                      {m.direction === "inbound" ? <Mail className="h-3 w-3" /> : <MailOpen className="h-3 w-3" />}
                      <span>{m.direction === "inbound" ? m.fromAddress : "You"}</span>
                      <span>·</span>
                      <span>{timeAgo(m.createdAt)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.textBody || "(no text content)"}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleReply} className="border-t p-3 flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`Reply to ${thread.counterpart}...`}
                  rows={2}
                  className="flex-1 text-sm bg-muted/40 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <button
                  type="submit"
                  disabled={replyMutation.isPending || !replyText.trim()}
                  className="shrink-0 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
              {replyMutation.isError && (
                <p className="text-xs text-red-600 px-3 pb-2">Failed to send reply. Please try again.</p>
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
