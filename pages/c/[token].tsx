import { useState } from "react";
import Head from "next/head";
import type { GetServerSideProps } from "next";
import { resolveConfidential, sanitizeConfidentialHtml, logConfidentialView, hashIp } from "@/lib/email/confidential";

type Restrict = { forward: boolean; copy: boolean; print: boolean };

type PageProps = {
  token: string;
  state:
    | { status: "not_found" | "revoked" | "expired" }
    | { status: "locked"; subject: string | null }
    | { status: "ok"; subject: string | null; bodyHtml: string; restrict: Restrict; expiresAt: string | null };
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{ background: "radial-gradient(120% 120% at 50% -10%, #2e0a4f 0%, #1b0833 45%, #0d0119 100%)" }}
      className="flex min-h-screen items-center justify-center p-4"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white p-8 shadow-2xl">{children}</div>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F5EFFF] text-2xl">🔒</div>
        <h1 className="text-lg font-semibold text-[#1E1B2E]">{title}</h1>
        <p className="mt-2 text-sm text-[#6B7280]">{body}</p>
      </div>
    </Shell>
  );
}

export default function ConfidentialViewerPage({ token, state }: PageProps) {
  const [unlocked, setUnlocked] = useState(state.status === "ok" ? state : null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/c/${encodeURIComponent(token)}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.status !== "ok") {
        throw new Error(data?.message || "This message is no longer available.");
      }
      setUnlocked({ status: "ok", subject: data.subject, bodyHtml: data.bodyHtml, restrict: data.restrict, expiresAt: data.expiresAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock.");
    } finally {
      setSubmitting(false);
    }
  };

  const head = (
    <Head>
      <title>Confidential message</title>
      <meta name="robots" content="noindex, nofollow" />
    </Head>
  );

  if (state.status === "not_found") return <>{head}<Notice title="Message not found" body="This confidential link is invalid." /></>;
  if (state.status === "revoked") return <>{head}<Notice title="Access revoked" body="The sender has revoked access to this message." /></>;
  if (state.status === "expired") return <>{head}<Notice title="Message expired" body="This confidential message is no longer available." /></>;

  if (!unlocked) {
    // Passcode-gated
    return (
      <>
        {head}
        <Shell>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F5EFFF] text-2xl">🔒</div>
            <h1 className="text-lg font-semibold text-[#1E1B2E]">Enter passcode</h1>
            <p className="mt-1 text-sm text-[#6B7280]">This message is protected. Enter the passcode the sender shared with you.</p>
          </div>
          <form onSubmit={submitPasscode} className="mx-auto mt-6 flex max-w-sm flex-col gap-3">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
              className="w-full rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-center text-lg tracking-widest text-[#1E1B2E] focus:border-[#701CC0] focus:outline-none focus:ring-2 focus:ring-[#701CC0]/30"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={!passcode.trim() || submitting}
              className="rounded-xl bg-[#701CC0] py-2.5 font-semibold text-white hover:bg-[#5F17A5] disabled:opacity-50"
            >
              {submitting ? "Unlocking…" : "Unlock"}
            </button>
          </form>
        </Shell>
      </>
    );
  }

  const r = unlocked.restrict;
  return (
    <>
      {head}
      {/* Soft restrictions: block print, and (if restricted) text selection. Deterrent, not DRM. */}
      <style jsx global>{`
        ${r.print ? "@media print { body { display: none !important; } }" : ""}
        ${r.copy ? ".confidential-body { user-select: none; -webkit-user-select: none; }" : ""}
      `}</style>
      <Shell>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#EEF0F4] pb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F5EFFF] text-sm">🔒</span>
            <div>
              <p className="text-sm font-semibold text-[#1E1B2E]">{unlocked.subject || "Confidential message"}</p>
              {unlocked.expiresAt ? (
                <p className="text-xs text-[#9CA3AF]">Expires {new Date(unlocked.expiresAt).toLocaleString()}</p>
              ) : null}
            </div>
          </div>
          <span className="rounded-full bg-[#F5EFFF] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#701CC0]">Confidential</span>
        </div>
        <div
          className="confidential-body prose prose-sm max-w-none text-[#1E1B2E]"
          onContextMenu={r.copy ? (e) => e.preventDefault() : undefined}
          onCopy={r.copy ? (e) => e.preventDefault() : undefined}
          dangerouslySetInnerHTML={{ __html: unlocked.bodyHtml }}
        />
        {r.forward || r.copy || r.print ? (
          <p className="mt-6 border-t border-[#EEF0F4] pt-3 text-xs text-[#9CA3AF]">
            The sender restricted this message
            {[r.forward && "forwarding", r.copy && "copying", r.print && "printing"].filter(Boolean).join(", ").replace(/, ([^,]*)$/, " and $1")
              ? ` (${[r.forward && "forwarding", r.copy && "copying", r.print && "printing"].filter(Boolean).join(", ")})`
              : ""}
            .
          </p>
        ) : null}
      </Shell>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const token = String(ctx.params?.token || "");
  const ipRaw = String(ctx.req.headers["x-forwarded-for"] || ctx.req.socket.remoteAddress || "").split(",")[0].trim();
  const state = await resolveConfidential(token, new Date());

  if (state.status === "ok") {
    await logConfidentialView(state.id, ipRaw ? hashIp(ipRaw) : null, true);
    return {
      props: {
        token,
        state: {
          status: "ok",
          subject: state.subject,
          bodyHtml: sanitizeConfidentialHtml(state.bodyHtml),
          restrict: state.restrict,
          expiresAt: state.expiresAt,
        },
      },
    };
  }
  if (state.status === "locked") {
    return { props: { token, state: { status: "locked", subject: state.subject } } };
  }
  return { props: { token, state: { status: state.status } } };
};
