import React, { useCallback, useEffect, useState } from "react";
import { FiLinkedin, FiRefreshCw, FiExternalLink, FiSend } from "react-icons/fi";

/**
 * LinkedIn unified inbox — conversations synced from the Vierra Sales Nav extension
 * (per user; a user only sees threads synced under their own extension token). Replies
 * are queued as send commands the extension executes on linkedin.com (no official API).
 * See docs/LINKEDIN_UNIFIED_INBOX_PLAN.md.
 */
type ThreadRow = {
  id: string;
  participantName: string | null;
  participantHeadline: string | null;
  participantUrl: string | null;
  lastMessageAt: string | null;
  unread: boolean;
  messageCount: number;
};

type ThreadMessage = {
  id: string;
  direction: string;
  body: string;
  at: string;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

const LinkedInInboxSection: React.FC = () => {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedThread, setSelectedThread] = useState<{ participantName: string | null; participantUrl: string | null; participantHeadline: string | null } | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/linkedin/threads", { headers: { "Cache-Control": "no-cache" } });
      const d = await r.json().catch(() => ({}));
      setThreads(Array.isArray(d?.threads) ? d.threads : []);
      setDegraded(Boolean(d?.degraded));
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const openThread = useCallback(async (id: string) => {
    setSelectedId(id);
    setMessagesLoading(true);
    setMessages([]);
    try {
      const r = await fetch(`/api/linkedin/threads/${encodeURIComponent(id)}`);
      const d = await r.json().catch(() => ({}));
      setMessages(Array.isArray(d?.messages) ? d.messages : []);
      setSelectedThread(d?.thread || null);
      // Reflect the read state locally.
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: false } : t)));
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const sendReply = async () => {
    if (sending || !selectedId || !reply.trim()) return;
    setSending(true);
    const body = reply.trim();
    try {
      const r = await fetch(`/api/linkedin/threads/${encodeURIComponent(selectedId)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (r.ok) {
        setReply("");
        // Optimistically append; the extension confirms + replaces on next sync.
        setMessages((prev) => [...prev, { id: `local:${Date.now()}`, direction: "out", body, at: new Date().toISOString() }]);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 text-[#1E1B2E]">
      {/* Thread list */}
      <div className="flex w-72 shrink-0 flex-col border-r border-white/30">
        <div className="flex items-center justify-between gap-2 border-b border-white/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <FiLinkedin className="h-4 w-4 text-[#0A66C2]" aria-hidden />
            <span className="text-xs font-medium text-[#6B7280]">
              LinkedIn · {threads.length} {threads.length === 1 ? "thread" : "threads"}
            </span>
          </div>
          <button
            type="button"
            onClick={loadThreads}
            disabled={loading}
            className="rounded-lg border border-[#E5E7EB] bg-white p-2 text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
            aria-label="Refresh threads"
            title="Refresh"
          >
            <FiRefreshCw className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && threads.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[#6B7280]">Loading…</p>
          ) : threads.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium text-[#4A465C]">No LinkedIn threads yet</p>
              <p className="mt-1 text-xs text-[#847FA0]">
                Pair the Vierra Sales Nav extension in Settings → LinkedIn extension, then browse your
                LinkedIn messages to sync them here.
              </p>
            </div>
          ) : (
            <ul>
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openThread(t.id)}
                    className={`flex w-full items-start gap-3 border-b border-white/20 px-4 py-3 text-left transition-colors hover:bg-white/40 ${
                      selectedId === t.id ? "bg-white/60" : ""
                    }`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A66C2]/10 text-xs font-semibold text-[#0A66C2]">
                      {(t.participantName || "?").charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${t.unread ? "font-semibold text-[#1E1B2E]" : "font-medium text-[#4A465C]"}`}>
                          {t.participantName || "Unknown"}
                        </span>
                        <span className="shrink-0 text-[10px] text-[#9A93AE]">{timeAgo(t.lastMessageAt)}</span>
                      </span>
                      {t.participantHeadline ? (
                        <span className="mt-0.5 block truncate text-xs text-[#847FA0]">{t.participantHeadline}</span>
                      ) : null}
                    </span>
                    {t.unread ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#0A66C2]" aria-label="Unread" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Conversation */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!selectedId ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <FiLinkedin className="h-8 w-8 text-[#0A66C2]/40" aria-hidden />
            <p className="mt-3 text-sm font-medium text-[#4A465C]">Select a conversation</p>
            {degraded ? (
              <p className="mt-1 text-xs text-[#847FA0]">LinkedIn sync isn’t set up yet — pair the extension in Settings.</p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-white/30 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1E1B2E]">
                  {selectedThread?.participantName || "Conversation"}
                </p>
                {selectedThread?.participantHeadline ? (
                  <p className="truncate text-xs text-[#847FA0]">{selectedThread.participantHeadline}</p>
                ) : null}
              </div>
              {selectedThread?.participantUrl ? (
                <a
                  href={selectedThread.participantUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#F3F4F6]"
                >
                  <FiExternalLink className="h-3.5 w-3.5" /> Profile
                </a>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {messagesLoading ? (
                <p className="text-center text-sm text-[#6B7280]">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-[#6B7280]">No messages in this thread.</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => {
                    const outbound = m.direction === "out";
                    return (
                      <div key={m.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                            outbound ? "bg-[#0A66C2] text-white" : "bg-white text-[#1E1B2E] border border-[#ECEAF1]"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={`mt-1 text-[10px] ${outbound ? "text-white/70" : "text-[#9A93AE]"}`}>
                            {new Date(m.at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-white/30 px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  rows={2}
                  placeholder="Write a reply… (⌘/Ctrl+Enter to queue)"
                  className="min-h-0 flex-1 resize-y rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1E1B2E] placeholder-[#9CA3AF] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
                />
                <button
                  type="button"
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0A66C2] px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#08529b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FiSend className="h-4 w-4" /> {sending ? "Queuing…" : "Send"}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-[#9A93AE]">
                Replies are queued and delivered by the paired extension the next time it’s active on LinkedIn.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LinkedInInboxSection;
