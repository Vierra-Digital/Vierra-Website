import React from "react";
import dynamic from "next/dynamic";
import {
  FiAlertCircle,
  FiCalendar,
  FiCheckSquare,
  FiChevronDown,
  FiClock,
  FiEdit3,
  FiFeather,
  FiFileText,
  FiImage,
  FiLink,
  FiLock,
  FiMaximize2,
  FiMinimize2,
  FiMinus,
  FiMoreVertical,
  FiPaperclip,
  FiPlus,
  FiPrinter,
  FiTrash2,
  FiType,
  FiX,
  FiZap,
} from "react-icons/fi";
import type { ComposeRichEditorHandle } from "@/components/email/ComposeRichEditor";
import PromptModal from "@/components/ui/PromptModal";
import { ComposeRichEditor, composeIconClass, composeMenuItemClass, toDatetimeLocalValue } from "./composeShared";
import type { ComposeWindowBundle } from "./hooks/useComposeWindow";

const SignPdfModal = dynamic(() => import("@/components/email/SignPdfModal"), { ssr: false });

/**
 * The full "New Message" / reply-in-a-window compose modal, plus the two modals that only make
 * sense alongside it (sign-PDF, save-template) and the Artemis draft prompt (reachable from here
 * or from InlineReply's "Help me write", which reuses this same compose state — see
 * useComposeWindow's doc comment).
 */
const ComposeWindow: React.FC<{ compose: ComposeWindowBundle }> = ({ compose }) => {
  const {
    isComposeOpen,
    composeTo, setComposeTo,
    composeCc, setComposeCc,
    composeBcc, setComposeBcc,
    showCc, setShowCc,
    showBcc, setShowBcc,
    composeSubject, setComposeSubject,
    composeBody,
    composeBodyHtml, setComposeBodyHtml, setComposeBody,
    composeAttachments, setComposeAttachments,
    signModalOpen, setSignModalOpen,
    composeBookingLinks,
    bookingMenuOpen,
    composeTemplates,
    composeSignatures,
    saveTemplateModalOpen, setSaveTemplateModalOpen,
    artemisPromptOpen, setArtemisPromptOpen,
    saveTemplateName, setSaveTemplateName,
    saveTemplateSaving,
    composeEditorRef,
    composeAttachInputRef,
    composeFormattingToolbarOpen, setComposeFormattingToolbarOpen,
    composeAccountEmail, setComposeAccountEmail,
    composeFrom, setComposeFrom,
    composeAliases,
    composeThreadId,
    sendingCompose,
    undoCountdown,
    scheduleAt, setScheduleAt,
    scheduleOpen, setScheduleOpen,
    composeMoreOpen, setComposeMoreOpen,
    confidentialOn, setConfidentialOn,
    confidentialExpiry, setConfidentialExpiry,
    confidentialPasscode, setConfidentialPasscode,
    confidentialOpen, setConfidentialOpen,
    requestReceipt, setRequestReceipt,
    artemisDrafting,
    artemisRewriteOpen, setArtemisRewriteOpen,
    composeError,
    composeSuccess,
    composeExpanded, setComposeExpanded,
    composeMinimized, setComposeMinimized,
    composeLintWarnings,
    composeHasMeaningfulBody,
    composeFromOptions,
    draftSaveState,
    closeCompose,
    discardCompose,
    handleSendCompose,
    cancelUndoSend,
    addComposeAttachmentsFromFiles,
    toggleBookingMenu,
    insertBookingLink,
    handleSaveComposeTemplate,
    applyComposeTemplate,
    applyComposeSignature,
    handlePrintCompose,
    handleArtemisDraft,
    runArtemisDraft,
    handleArtemisRewrite,
  } = compose;

  return (
    <>
      {isComposeOpen ? (
        <div
          className={
            composeExpanded
              ? "fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
              : "contents"
          }
          onClick={composeExpanded ? () => setComposeExpanded(false) : undefined}
          role="presentation"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className={`compose-hud flex flex-col overflow-hidden bg-white shadow-[0_24px_60px_-18px_rgba(46,16,80,0.5)] ${
              composeExpanded
                ? "h-[75vh] w-[75vw] max-h-[75vh] max-w-[75vw] rounded-2xl"
                : composeMinimized
                // Collapsed to just the header bar, Gmail-style — no explicit height, so the hud
                // shrinks to whatever the header row's own content requires once the body below
                // stops rendering.
                ? "fixed bottom-6 right-6 z-[120] w-[min(100vw-1.5rem,320px)] rounded-t-2xl"
                // An explicit height (not max-height) so the flex-1 body editor below actually has
                // free space to grow into — max-height alone lets the column shrink to fit its
                // content instead of stretching, which is why the editor used to render as a small
                // fixed box even though the window had room to spare.
                : "fixed bottom-6 right-6 z-[120] w-[min(100vw-1.5rem,572px)] h-[min(92vh,760px)] rounded-2xl"
            }`}
            role="dialog"
            aria-label={composeThreadId ? "Reply composer" : "New message composer"}
          >
            <div
              onClick={composeExpanded ? undefined : () => setComposeMinimized((prev) => !prev)}
              className={`compose-hud-header flex shrink-0 items-center justify-between gap-2 px-4 py-2.5 ${
                composeExpanded ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <p className="min-w-0 flex-1 truncate pr-2 text-sm font-semibold text-white">
                {composeMinimized && (composeTo.trim() || composeSubject.trim())
                  ? composeSubject.trim() || composeTo.trim()
                  : composeThreadId
                  ? "Reply"
                  : "New Message"}
              </p>
              <div className="flex shrink-0 items-center">
                {!composeExpanded ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setComposeMinimized((prev) => !prev);
                    }}
                    className="rounded-full p-2 text-white/90 hover:bg-white/15"
                    title={composeMinimized ? "Restore" : "Minimize"}
                    aria-label={composeMinimized ? "Restore composer" : "Minimize composer"}
                  >
                    <FiMinus className="h-5 w-5" />
                  </button>
                ) : null}
                {!composeMinimized ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setComposeExpanded((prev) => !prev);
                    }}
                    className="rounded-full p-2 text-white/90 hover:bg-white/15"
                    title={composeExpanded ? "Resize" : "Expand"}
                    aria-label={composeExpanded ? "Shrink composer" : "Expand composer"}
                  >
                    {composeExpanded ? <FiMinimize2 className="h-5 w-5" /> : <FiMaximize2 className="h-5 w-5" />}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeCompose();
                  }}
                  className="rounded-full p-2 text-white/90 hover:bg-white/15"
                  title="Close"
                  disabled={sendingCompose}
                  aria-label="Close compose"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>

            {composeMinimized ? null : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-0">
                <div className="shrink-0 px-3">
                  <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-2 border-b border-[#EAE5F4] py-1">
                    <span className="min-w-0 text-left text-sm leading-none text-[#5f6368]">From</span>
                    <div className="relative min-w-0">
                      <select
                        value={composeFrom || composeAccountEmail}
                        onChange={(event) => {
                          const value = event.target.value;
                          setComposeFrom(value);
                          if (composeFromOptions.includes(value)) {
                            setComposeAccountEmail(value);
                            return;
                          }
                          // An alias only sends through the mailbox that owns it — picking one
                          // has to move the sending account too, or Gmail rejects the send.
                          const owner = composeAliases.find((alias) => alias.email === value)?.accountEmail;
                          if (owner) setComposeAccountEmail(owner);
                        }}
                        className="min-w-0 w-full cursor-pointer appearance-none border-0 bg-transparent py-1.5 pl-0 pr-7 text-sm text-[#1E1B2E] outline-none focus:ring-0"
                      >
                        {composeFromOptions.map((email) => (
                          <option key={email} value={email}>
                            {email}
                          </option>
                        ))}
                        {composeAliases
                          // Drop the primaries — they're already listed above as accounts.
                          .filter((alias) => !composeFromOptions.includes(alias.email))
                          .map((alias) => (
                            <option key={`${alias.accountEmail}::${alias.email}`} value={alias.email}>
                              {alias.displayName ? `${alias.displayName} <${alias.email}>` : alias.email}
                            </option>
                          ))}
                      </select>
                      <FiChevronDown
                        className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5f6368]"
                        aria-hidden
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-2 border-b border-[#EAE5F4] py-1">
                    <span className="min-w-0 text-left text-sm leading-none text-[#5f6368]">To</span>
                    <div className="flex min-w-0 items-center gap-2">
                      <input
                        value={composeTo}
                        onChange={(event) => setComposeTo(event.target.value)}
                        placeholder=""
                        className="min-w-0 flex-1 border-0 bg-transparent py-1.5 pl-0 text-sm text-[#1E1B2E] outline-none placeholder:text-[#70757a]"
                      />
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCc((prev) => !prev)}
                          className={`whitespace-nowrap text-sm font-medium hover:underline ${
                            showCc ? "text-[#701CC0]" : "text-[#701CC0]"
                          }`}
                          aria-pressed={showCc}
                          title={showCc ? "Hide Cc field" : "Show Cc field"}
                        >
                          Cc
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowBcc((prev) => !prev)}
                          className={`whitespace-nowrap text-sm font-medium hover:underline ${
                            showBcc ? "text-[#701CC0]" : "text-[#701CC0]"
                          }`}
                          aria-pressed={showBcc}
                          title={showBcc ? "Hide Bcc field" : "Show Bcc field"}
                        >
                          Bcc
                        </button>
                      </div>
                    </div>
                  </div>

                  {showCc ? (
                    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-2 border-b border-[#EAE5F4] py-1">
                      <span className="min-w-0 text-left text-sm leading-none text-[#5f6368]">Cc</span>
                      <input
                        value={composeCc}
                        onChange={(event) => setComposeCc(event.target.value)}
                        placeholder=""
                        className="min-w-0 border-0 bg-transparent py-1.5 pl-0 text-sm text-[#1E1B2E] outline-none"
                      />
                    </div>
                  ) : null}

                  {showBcc ? (
                    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-2 border-b border-[#EAE5F4] py-1">
                      <span className="min-w-0 text-left text-sm leading-none text-[#5f6368]">Bcc</span>
                      <input
                        value={composeBcc}
                        onChange={(event) => setComposeBcc(event.target.value)}
                        placeholder=""
                        className="min-w-0 border-0 bg-transparent py-1.5 pl-0 text-sm text-[#1E1B2E] outline-none"
                      />
                    </div>
                  ) : null}

                  <div className="grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-2 border-b border-[#EAE5F4] py-1">
                    <span className="min-w-0 text-left text-sm leading-none text-[#5f6368]">Subject</span>
                    <input
                      value={composeSubject}
                      onChange={(event) => setComposeSubject(event.target.value)}
                      placeholder=""
                      className="min-w-0 border-0 bg-transparent py-1.5 pl-0 text-sm text-[#1E1B2E] outline-none"
                    />
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col px-3 pb-1 pt-3">
                  <ComposeRichEditor
                    ref={composeEditorRef as React.RefObject<ComposeRichEditorHandle>}
                    valueHtml={composeBodyHtml}
                    onChange={({ html, text }) => {
                      setComposeBodyHtml(html);
                      setComposeBody(text);
                    }}
                    minHeightClass="min-h-0 flex-1"
                    className="min-h-0 flex-1 flex flex-col overflow-hidden"
                    showToolbar={composeFormattingToolbarOpen}
                  />
                  {composeAttachments.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {composeAttachments.map((attachment) => (
                        <span
                          key={attachment.id}
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#EAE5F4] bg-[#f8f9fa] px-2 py-0.5 text-xs text-[#1E1B2E]"
                        >
                          <span className="min-w-0 truncate">{attachment.filename}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded-full p-0.5 text-[#5f6368] hover:bg-[#e8eaed]"
                            onClick={() =>
                              setComposeAttachments((prev) => prev.filter((a) => a.id !== attachment.id))
                            }
                            aria-label={`Remove ${attachment.filename}`}
                          >
                            <FiX className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <input
                    ref={composeAttachInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (event) => {
                      await addComposeAttachmentsFromFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </div>
              </div>

              <div className="shrink-0 border-t border-[#EAE5F4] bg-white px-3 py-2">
                {draftSaveState && <p role="status" className="text-sm">{draftSaveState}</p>}
                {composeError ? (
                  <div className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">{composeError}</div>
                ) : null}
                {undoCountdown !== null ? (
                  <div className="mb-2 flex items-center justify-between rounded-lg bg-[#1E1B2E] px-3 py-2 text-xs font-medium text-white">
                    <span>Sending in {undoCountdown}s…</span>
                    <button type="button" onClick={cancelUndoSend} className="font-semibold underline underline-offset-2">
                      Undo
                    </button>
                  </div>
                ) : null}
                {composeLintWarnings.length > 0 ? (
                  <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                    <FiAlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <div>
                      <span className="font-semibold">Deliverability check:</span>
                      <ul className="mt-0.5 list-disc pl-4">
                        {composeLintWarnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
                {composeSuccess ? (
                  <div className="mb-2 rounded border border-green-200 bg-green-50 px-2 py-1.5 text-xs text-green-800">
                    {composeSuccess}
                  </div>
                ) : null}
                <div className="compose-actions flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={handleSendCompose}
                      aria-label={`Send from ${composeFrom || composeAccountEmail}`}
                      disabled={
                        sendingCompose ||
                        undoCountdown !== null ||
                        !composeTo.trim() ||
                        !composeHasMeaningfulBody ||
                        !composeAccountEmail
                      }
                      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md bg-[#701CC0] px-6 text-sm font-semibold text-white hover:bg-[#5F17A5] disabled:pointer-events-none disabled:opacity-40"
                    >
                      {sendingCompose ? "Sending…" : scheduleAt ? "Schedule send" : "Send"}
                    </button>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setScheduleOpen((open) => !open)}
                        title="Schedule send"
                        aria-label="Schedule send"
                        aria-pressed={scheduleOpen || Boolean(scheduleAt)}
                        className={composeIconClass(Boolean(scheduleAt) || scheduleOpen)}
                      >
                        <FiClock className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      {scheduleOpen ? (
                        <div className="absolute bottom-full left-0 z-[130] mb-1 w-72 rounded-lg border border-[#EAE5F4] bg-white p-3 shadow-lg">
                          <label htmlFor="compose-schedule-at" className="mb-1.5 block text-xs font-semibold text-[#1E1B2E]">
                            Send at
                          </label>
                          <input
                            id="compose-schedule-at"
                            type="datetime-local"
                            value={scheduleAt}
                            // Straight extraction from EmailingPlatformSection.tsx (unchanged
                            // behavior) — the lower bound is meant to track "now" live across
                            // re-renders while the schedule popover is open, not freeze at open time.
                            // eslint-disable-next-line react-hooks/purity
                            min={toDatetimeLocalValue(new Date(Date.now() + 60_000))}
                            onChange={(event) => setScheduleAt(event.target.value)}
                            className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 text-sm text-[#1E1B2E] focus:border-[#701CC0] focus:outline-none focus:ring-1 focus:ring-[#701CC0]"
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {scheduleAt ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setScheduleAt("");
                                  setScheduleOpen(false);
                                }}
                                className="text-xs font-medium text-[#6B7280] hover:text-[#1E1B2E]"
                              >
                                Clear
                              </button>
                            ) : (
                              <span />
                            )}
                            <button
                              type="button"
                              disabled={!scheduleAt}
                              onClick={() => {
                                setScheduleOpen(false);
                                handleSendCompose();
                              }}
                              className="inline-flex items-center gap-1 rounded bg-[#701CC0] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5F17A5] disabled:opacity-40"
                            >
                              <FiClock className="h-3.5 w-3.5" aria-hidden /> Schedule send
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setConfidentialOpen((open) => !open)}
                        title="Confidential mode"
                        aria-label="Confidential mode"
                        aria-pressed={confidentialOn}
                        className={composeIconClass(confidentialOn || confidentialOpen)}
                      >
                        <FiLock className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      {confidentialOpen ? (
                        <div className="absolute bottom-full left-0 z-[130] mb-1 w-72 rounded-lg border border-[#EAE5F4] bg-white p-3 shadow-lg">
                          <label className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#1E1B2E]">Confidential mode</span>
                            <input
                              type="checkbox"
                              checked={confidentialOn}
                              onChange={(event) => setConfidentialOn(event.target.checked)}
                              className="h-4 w-4"
                            />
                          </label>
                          <p className="mt-1 text-[11px] leading-relaxed text-[#6B7280]">
                            Sends a secure link instead of the body. Recipients can’t forward, copy, or print, and access can expire or be revoked.
                          </p>
                          {confidentialOn ? (
                            <div className="mt-3 space-y-2">
                              <div>
                                <label htmlFor="conf-expiry" className="mb-1 block text-[11px] font-medium text-[#6B7280]">
                                  Expires
                                </label>
                                <select
                                  id="conf-expiry"
                                  value={confidentialExpiry}
                                  onChange={(event) => setConfidentialExpiry(event.target.value as typeof confidentialExpiry)}
                                  className="w-full rounded border border-[#E5E7EB] px-2 py-1.5 text-sm text-[#1E1B2E] focus:border-[#701CC0] focus:outline-none focus:ring-1 focus:ring-[#701CC0]"
                                >
                                  <option value="1d">1 day</option>
                                  <option value="1w">1 week</option>
                                  <option value="1m">1 month</option>
                                  <option value="never">No expiry</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor="conf-passcode" className="mb-1 block text-[11px] font-medium text-[#6B7280]">
                                  Passcode (optional — share separately)
                                </label>
                                <input
                                  id="conf-passcode"
                                  type="text"
                                  value={confidentialPasscode}
                                  onChange={(event) => setConfidentialPasscode(event.target.value)}
                                  placeholder="e.g. 4821"
                                  className="w-full rounded border border-[#E5E7EB] px-2.5 py-1.5 text-sm text-[#1E1B2E] focus:border-[#701CC0] focus:outline-none focus:ring-1 focus:ring-[#701CC0]"
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRequestReceipt((on) => !on)}
                      title="Request read receipt"
                      aria-label="Request read receipt"
                      aria-pressed={requestReceipt}
                      className={composeIconClass(requestReceipt)}
                    >
                      <FiCheckSquare className="h-[18px] w-[18px]" aria-hidden />
                    </button>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setArtemisRewriteOpen((open) => !open)}
                        disabled={artemisDrafting}
                        title="Artemis AI"
                        aria-label="Artemis AI"
                        aria-expanded={artemisRewriteOpen}
                        className={composeIconClass(artemisRewriteOpen || artemisDrafting)}
                      >
                        <FiZap className={`h-[18px] w-[18px] ${artemisDrafting ? "animate-pulse" : ""}`} aria-hidden />
                      </button>
                      {artemisRewriteOpen ? (
                        <div className="compose-menu absolute bottom-full left-0 z-[130] mb-2 w-52">
                          <button
                            type="button"
                            onClick={() => {
                              setArtemisRewriteOpen(false);
                              void handleArtemisDraft();
                            }}
                            disabled={artemisDrafting}
                            className={composeMenuItemClass}
                          >
                            <FiZap className="h-4 w-4 shrink-0" aria-hidden />
                            {artemisDrafting ? "Drafting…" : "Draft for me"}
                          </button>
                          <div className="my-1 h-px bg-white/[0.07]" />
                          <p className="px-3 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#7C7695]">
                            Rewrite
                          </p>
                          {([
                            ["shorten", "Make shorter"],
                            ["expand", "Expand"],
                            ["formal", "More formal"],
                            ["casual", "More casual"],
                            ["grammar", "Fix grammar"],
                          ] as const).map(([mode, label]) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => handleArtemisRewrite(mode)}
                              disabled={artemisDrafting || !composeBody.trim()}
                              className={composeMenuItemClass}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="relative flex min-w-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setComposeFormattingToolbarOpen((open) => !open)}
                        className={composeIconClass(composeFormattingToolbarOpen)}
                        title="Formatting options"
                        aria-label="Formatting options"
                        aria-pressed={composeFormattingToolbarOpen}
                      >
                        <FiType className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => composeAttachInputRef.current?.click()}
                        className={composeIconClass()}
                        title="Attach files"
                        aria-label="Attach files"
                      >
                        <FiPaperclip className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={toggleBookingMenu}
                          className={composeIconClass(bookingMenuOpen)}
                          title="Insert booking link"
                          aria-label="Insert booking link"
                          aria-expanded={bookingMenuOpen}
                        >
                          <FiCalendar className="h-[18px] w-[18px]" aria-hidden />
                        </button>
                        {bookingMenuOpen ? (
                          <div className="compose-menu absolute bottom-full left-0 z-[130] mb-2 w-64">
                            {composeBookingLinks.length === 0 ? (
                              <p className="px-3 py-2 text-xs leading-relaxed text-[#8C86A6]">
                                No active booking links. Create one in Settings → Meeting booking.
                              </p>
                            ) : (
                              composeBookingLinks.map((l) => (
                                <button
                                  key={l.id}
                                  type="button"
                                  onClick={() => insertBookingLink(l.slug, l.title)}
                                  className={`${composeMenuItemClass} truncate`}
                                >
                                  {l.title}
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => composeEditorRef.current?.promptInsertLink()}
                        className={composeIconClass()}
                        title="Insert link"
                        aria-label="Insert link"
                      >
                        <FiLink className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => composeEditorRef.current?.promptInsertImage()}
                        className={composeIconClass()}
                        title="Insert image"
                        aria-label="Insert image"
                      >
                        <FiImage className="h-[18px] w-[18px]" aria-hidden />
                      </button>
                      {/* Gmail keeps its second-tier actions behind one "More options" button rather
                          than a second row of controls — templates, signatures, print and the
                          signature request live here so the bar stays a single line. */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setComposeMoreOpen((open) => !open)}
                          className={composeIconClass(composeMoreOpen)}
                          title="More options"
                          aria-label="More options"
                          aria-expanded={composeMoreOpen}
                        >
                          <FiMoreVertical className="h-[18px] w-[18px]" aria-hidden />
                        </button>
                        {composeMoreOpen ? (
                          <div className="compose-menu absolute bottom-full left-0 z-[130] mb-2 max-h-[min(60vh,22rem)] w-60 overflow-y-auto">
                            <p className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#7C7695]">
                              Templates
                            </p>
                            {composeTemplates.length === 0 ? (
                              <p className="px-3 pb-1.5 text-xs text-[#8C86A6]">No templates yet</p>
                            ) : (
                              composeTemplates.map((template) => (
                                <button
                                  key={template.id}
                                  type="button"
                                  className={`${composeMenuItemClass} truncate`}
                                  onClick={() => {
                                    setComposeMoreOpen(false);
                                    applyComposeTemplate(template.id);
                                  }}
                                >
                                  <FiFileText className="h-4 w-4 shrink-0" aria-hidden />
                                  <span className="truncate">{template.name}</span>
                                </button>
                              ))
                            )}
                            <button
                              type="button"
                              className={`${composeMenuItemClass} text-[#C8A6F5]`}
                              onClick={() => {
                                setComposeMoreOpen(false);
                                setSaveTemplateName("");
                                setSaveTemplateModalOpen(true);
                              }}
                            >
                              <FiPlus className="h-4 w-4 shrink-0" aria-hidden />
                              Save as template…
                            </button>

                            <div className="my-1 h-px bg-white/[0.07]" />
                            <p className="px-3 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#7C7695]">
                              Signatures
                            </p>
                            {composeSignatures.length === 0 ? (
                              <p className="px-3 pb-1.5 text-xs text-[#8C86A6]">No signatures yet</p>
                            ) : (
                              composeSignatures.map((sig) => (
                                <button
                                  key={sig.id}
                                  type="button"
                                  className={`${composeMenuItemClass} truncate`}
                                  onClick={() => {
                                    setComposeMoreOpen(false);
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

                            <div className="my-1 h-px bg-white/[0.07]" />
                            <button
                              type="button"
                              className={composeMenuItemClass}
                              onClick={() => {
                                setComposeMoreOpen(false);
                                setSignModalOpen(true);
                              }}
                            >
                              <FiFeather className="h-4 w-4 shrink-0" aria-hidden />
                              Request signature
                            </button>
                            <button
                              type="button"
                              className={composeMenuItemClass}
                              onClick={() => {
                                setComposeMoreOpen(false);
                                handlePrintCompose();
                              }}
                            >
                              <FiPrinter className="h-4 w-4 shrink-0" aria-hidden />
                              Print
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={discardCompose}
                    className={composeIconClass()}
                    title="Discard draft"
                    aria-label="Discard draft"
                  >
                    <FiTrash2 className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      ) : null}

      <SignPdfModal
        open={signModalOpen}
        onClose={() => setSignModalOpen(false)}
        defaultSignerEmail={composeTo.split(",")[0]?.trim() || ""}
        pdfCandidates={composeAttachments
          .filter((a) => a.contentType === "application/pdf" || a.filename.toLowerCase().endsWith(".pdf"))
          .map((a) => ({ id: a.id, filename: a.filename, contentBase64: a.contentBase64 }))}
        onLinkReady={(url: string, filename: string) =>
          composeEditorRef.current?.insertLink(url, `Sign “${filename}”`)
        }
      />

      {saveTemplateModalOpen ? (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-[#2E1050]/45 backdrop-blur-sm p-4"
          onClick={() => !saveTemplateSaving && setSaveTemplateModalOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white/90 backdrop-blur-xl border border-white/70 p-5 shadow-[0_30px_70px_-20px_rgba(46,16,80,0.55)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Save template"
          >
            <p className="text-sm font-semibold text-[#1E1B2E]">Save template</p>
            <label className="mt-3 block text-xs font-medium text-[#5f6368]" htmlFor="compose-template-name">
              Name
            </label>
            <input
              id="compose-template-name"
              type="text"
              value={saveTemplateName}
              onChange={(event) => setSaveTemplateName(event.target.value)}
              className="mt-1 w-full rounded-md border border-[#EAE5F4] px-3 py-2 text-sm text-[#1E1B2E] outline-none focus:ring-2 focus:ring-[#701CC0]"
              placeholder="Template name"
              disabled={saveTemplateSaving}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={saveTemplateSaving}
                onClick={() => setSaveTemplateModalOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveTemplateSaving || !saveTemplateName.trim()}
                onClick={() => void handleSaveComposeTemplate()}
                className="rounded-md bg-[#701CC0] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#5f17a5] disabled:opacity-50"
              >
                {saveTemplateSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PromptModal
        open={artemisPromptOpen}
        title="Draft with Artemis"
        description="Describe what this email should say. Artemis writes a first draft you can edit before sending."
        fields={[{ name: "intent", type: "textarea", placeholder: "e.g. Follow up on our call and propose next week for a quick demo", required: true, maxLength: 2000 }]}
        confirmLabel="Draft it"
        busy={artemisDrafting}
        onCancel={() => setArtemisPromptOpen(false)}
        onSubmit={(values) => void runArtemisDraft(values.intent)}
      />
    </>
  );
};

export default ComposeWindow;
