import React from "react";
import { EMAIL_REGEX } from "@/lib/utils";
import {
  FiCornerUpLeft,
  FiEdit3,
  FiImage,
  FiLink,
  FiLock,
  FiPaperclip,
  FiSend,
  FiTrash2,
  FiType,
  FiX,
} from "react-icons/fi";
import { MdReplyAll } from "react-icons/md";
import { REPLY_ACTION_BUTTON } from "@/components/email/emailTheme";
import type { ComposeRichEditorHandle } from "@/components/email/ComposeRichEditor";
import { BoltDraw, ComposeRichEditor, DriveMark, composeMenuItemClass } from "./composeShared";
import type { ComposeWindowBundle } from "./hooks/useComposeWindow";

/**
 * Reply / Reply all / Forward, embedded in the message reader — the trigger row shown between the
 * thread and its (absent) inline composer, and the inline composer card itself once one of those
 * is clicked. Reuses `compose`'s Artemis draft flow, attachment input, signatures and confidential
 * toggle (same bundle ComposeWindow renders from) rather than owning independent copies — see
 * useComposeWindow's doc comment for why.
 */
const InlineReply: React.FC<{ compose: ComposeWindowBundle }> = ({ compose }) => {
  const {
    inlineComposeMode, setInlineComposeMode,
    inlineComposeTo, setInlineComposeTo,
    inlineComposeCc, setInlineComposeCc,
    inlineComposeBcc, setInlineComposeBcc,
    inlineShowCc, setInlineShowCc,
    inlineToEditing, setInlineToEditing,
    inlineShowFormatting, setInlineShowFormatting,
    inlineShowBcc, setInlineShowBcc,
    inlineMoreOpen, setInlineMoreOpen,
    inlineComposeSubject, setInlineComposeSubject,
    inlineComposeIntroHtml, setInlineComposeIntroHtml, setInlineComposeIntroText,
    inlineEditorRef,
    inlineComposePreviewHtml,
    inlineComposeSending,
    inlineComposeError,
    inlineComposeSuccess,
    inlineComposeRef,
    inlineDraftStorageKey,
    composeSignatures,
    composeAttachInputRef,
    confidentialOn, setConfidentialOpen,
    artemisDrafting,
    applyComposeSignature,
    openReplyCompose,
    openReplyAllCompose,
    openForwardCompose,
    sendInlineCompose,
    clearLocalDraft,
    handleArtemisDraft,
    loadMailboxCounts,
    sanitizeInlinePreviewHtml,
    inlineComposeBodyText,
    inlineComposeIntroText,
  } = compose;

  return (
    <>
      {!inlineComposeMode ? (
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <button
            type="button"
            onClick={() => {
              void openReplyCompose();
            }}
            className={REPLY_ACTION_BUTTON}
          >
            <FiCornerUpLeft className="h-4 w-4" aria-hidden />
            Reply
          </button>
          <button
            type="button"
            onClick={() => {
              void openReplyAllCompose();
            }}
            className={REPLY_ACTION_BUTTON}
          >
            <MdReplyAll className="h-[18px] w-[18px]" aria-hidden />
            Reply all
          </button>
          <button
            type="button"
            onClick={() => {
              void openForwardCompose();
            }}
            className={REPLY_ACTION_BUTTON}
          >
            <FiSend className="h-4 w-4" aria-hidden />
            Forward
          </button>
        </div>
      ) : null}

      {inlineComposeMode ? (
        <div ref={inlineComposeRef} className="pt-3">
          <div className="inline-reply-card rounded-xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-2.5">
              <span className="shrink-0 text-[13px] text-[#6B7280]">To</span>
              {inlineToEditing ? (
                <input
                  value={inlineComposeTo}
                  onChange={(event) => setInlineComposeTo(event.target.value)}
                  onBlur={() => setInlineToEditing(false)}
                  autoFocus
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[#1E1B2E] outline-none placeholder:text-[#9CA3AF]"
                  placeholder="name@email.com, second@email.com"
                  aria-label="To (comma separated)"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setInlineToEditing(true)}
                  className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-left"
                  title="Click to edit recipients (comma separated)"
                >
                  {inlineComposeTo
                    .split(",")
                    .map((entry) => entry.trim())
                    .filter(Boolean).length === 0 ? (
                    <span className="text-[13px] text-[#9CA3AF]">Add recipients</span>
                  ) : (
                    inlineComposeTo
                      .split(",")
                      .map((entry) => entry.trim())
                      .filter(Boolean)
                      .map((addr, index, all) => {
                        const bare = addr.includes("<")
                          ? (addr.match(/<([^>]+)>/)?.[1] || addr).trim()
                          : addr;
                        const valid = EMAIL_REGEX.test(bare);
                        return (
                          <span
                            key={`${addr}-${index}`}
                            className={`recipient-chip ${valid ? "" : "is-invalid"}`}
                            title={valid ? addr : `${addr} — not a valid address`}
                          >
                            <span className="truncate">{addr}</span>
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={`Remove ${addr}`}
                              className="recipient-chip-x"
                              onClick={(event) => {
                                event.stopPropagation();
                                setInlineComposeTo(all.filter((_, i) => i !== index).join(", "));
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.stopPropagation();
                                event.preventDefault();
                                setInlineComposeTo(all.filter((_, i) => i !== index).join(", "));
                              }}
                            >
                              <FiX className="h-3 w-3" aria-hidden />
                            </span>
                          </span>
                        );
                      })
                  )}
                </button>
              )}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInlineShowCc((open) => !open)}
                  aria-pressed={inlineShowCc}
                  className="text-[12px] font-medium text-[#701CC0] hover:underline"
                >
                  Cc
                </button>
                <button
                  type="button"
                  onClick={() => setInlineShowBcc((open) => !open)}
                  aria-pressed={inlineShowBcc}
                  className="text-[12px] font-medium text-[#701CC0] hover:underline"
                >
                  Bcc
                </button>
              </div>
            </div>

            {inlineShowCc ? (
              <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-2.5">
                <span className="shrink-0 text-[13px] text-[#6B7280]">Cc</span>
                <input
                  value={inlineComposeCc}
                  onChange={(event) => setInlineComposeCc(event.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[#1E1B2E] outline-none"
                  aria-label="Cc"
                />
              </div>
            ) : null}
            {inlineShowBcc ? (
              <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-2.5">
                <span className="shrink-0 text-[13px] text-[#6B7280]">Bcc</span>
                <input
                  value={inlineComposeBcc}
                  onChange={(event) => setInlineComposeBcc(event.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[#1E1B2E] outline-none"
                  aria-label="Bcc"
                />
              </div>
            ) : null}

            {inlineComposeMode === "forward" ? (
              <div className="flex items-center gap-2 border-b border-[#E5E7EB] px-4 py-2.5">
                <span className="shrink-0 text-[13px] text-[#6B7280]">Subject</span>
                <input
                  value={inlineComposeSubject}
                  onChange={(event) => setInlineComposeSubject(event.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[#1E1B2E] outline-none"
                  aria-label="Subject"
                />
              </div>
            ) : null}

            <div className="px-2 pb-1 pt-2">
              <ComposeRichEditor
                ref={inlineEditorRef as React.RefObject<ComposeRichEditorHandle>}
                valueHtml={inlineComposeIntroHtml}
                onChange={({ html, text }) => {
                  setInlineComposeIntroHtml(html);
                  setInlineComposeIntroText(text);
                }}
                minHeightClass="min-h-[150px]"
                showToolbar={inlineShowFormatting}
              />
            </div>

            {inlineComposeMode === "forward" && inlineComposePreviewHtml ? (
              <div className="mx-4 mb-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                <p className="mb-2 text-[11px] uppercase tracking-wide text-[#6B7280]">
                  Forwarded message
                </p>
                <div
                  className="max-h-48 overflow-y-auto text-sm leading-6 text-[#374151]"
                  dangerouslySetInnerHTML={{ __html: sanitizeInlinePreviewHtml(inlineComposePreviewHtml) }}
                />
              </div>
            ) : null}

            {inlineComposeError ? (
              <p className="mx-4 mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                {inlineComposeError}
              </p>
            ) : null}
            {inlineComposeSuccess ? (
              <p className="mx-4 mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                {inlineComposeSuccess}
              </p>
            ) : null}

            <div className="inline-reply-bar flex flex-wrap items-center gap-1 px-3 pb-2.5 pt-1.5">
              <button
                type="button"
                onClick={sendInlineCompose}
                disabled={
                  inlineComposeSending ||
                  !inlineComposeTo.trim() ||
                  !inlineComposeTo
                    .split(",")
                    .map((entry) => entry.trim())
                    .filter(Boolean)
                    .every((entry) =>
                      EMAIL_REGEX.test(entry.includes("<") ? (entry.match(/<([^>]+)>/)?.[1] || entry).trim() : entry)
                    ) ||
                  (!inlineComposeIntroText.trim() && !inlineComposeBodyText.trim())
                }
                className="compose-cta inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium text-white shadow-[0_6px_20px_-8px_rgba(94,23,168,0.9)] transition-[filter] duration-200 ease-out hover:brightness-[1.08] active:brightness-[0.96] disabled:pointer-events-none disabled:opacity-40"
              >
                <FiSend className="h-4 w-4 shrink-0" aria-hidden />
                {inlineComposeSending ? "Sending…" : "Send"}
              </button>

              <button
                type="button"
                onClick={() => void handleArtemisDraft()}
                disabled={artemisDrafting}
                className="inline-reply-icon email-tip"
                data-tip={artemisDrafting ? "Writing…" : "Help me write"}
                aria-label="Help me write"
              >
                <BoltDraw className="h-4 w-4" drafting={artemisDrafting} />
              </button>

              <button
                type="button"
                onClick={() => setInlineShowFormatting((open) => !open)}
                aria-pressed={inlineShowFormatting}
                className={`inline-reply-icon email-tip ${inlineShowFormatting ? "is-on" : ""}`}
                data-tip="Formatting options"
                aria-label="Formatting options"
              >
                <FiType className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => composeAttachInputRef.current?.click()}
                className="inline-reply-icon email-tip"
                data-tip="Attach files"
                aria-label="Attach files"
              >
                <FiPaperclip className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                disabled
                className="inline-reply-icon email-tip"
                data-tip="Insert from Drive (coming soon)"
                aria-label="Insert from Drive"
              >
                <DriveMark className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => inlineEditorRef.current?.promptInsertLink()}
                className="inline-reply-icon email-tip"
                data-tip="Insert link"
                aria-label="Insert link"
              >
                <FiLink className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => inlineEditorRef.current?.promptInsertImage()}
                className="inline-reply-icon email-tip"
                data-tip="Insert image"
                aria-label="Insert image"
              >
                <FiImage className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setConfidentialOpen((open) => !open)}
                aria-pressed={confidentialOn}
                className={`inline-reply-icon email-tip ${confidentialOn ? "is-on" : ""}`}
                data-tip="Confidential mode"
                aria-label="Confidential mode"
              >
                <FiLock className="h-4 w-4" aria-hidden />
              </button>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setInlineMoreOpen((open) => !open)}
                  className="inline-reply-icon email-tip"
                  data-tip="Insert signature"
                  aria-label="Insert signature"
                  aria-expanded={inlineMoreOpen}
                >
                  <FiEdit3 className="h-4 w-4" aria-hidden />
                </button>
                {inlineMoreOpen ? (
                  <div className="compose-menu absolute bottom-full left-0 z-[60] mb-2 w-52">
                    {composeSignatures.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-[#8C86A6]">No signatures yet</p>
                    ) : (
                      composeSignatures.map((sig) => (
                        <button
                          key={sig.id}
                          type="button"
                          className={`${composeMenuItemClass} truncate`}
                          onClick={() => {
                            setInlineMoreOpen(false);
                            applyComposeSignature(sig.id);
                          }}
                        >
                          <FiEdit3 className="h-4 w-4 shrink-0" aria-hidden />
                          <span className="truncate">
                            {sig.name}
                            {sig.isDefault ? " (default)" : ""}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>

              <span className="flex-1" aria-hidden />
              <button
                type="button"
                onClick={() => {
                  // Discard means gone: drop the autosaved draft rather
                  // than flushing it, or every abandoned reply would
                  // accumulate in Drafts.
                  if (inlineDraftStorageKey) {
                    void clearLocalDraft(inlineDraftStorageKey).catch(() => null);
                  }
                  setInlineComposeMode(null);
                  void loadMailboxCounts();
                }}
                className="inline-reply-icon email-tip"
                data-tip="Discard Reply"
                aria-label="Discard Reply"
              >
                <FiTrash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default InlineReply;
