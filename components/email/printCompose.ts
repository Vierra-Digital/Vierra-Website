// Split out of ComposeRichEditor.tsx so callers that only need this function (not the editor
// itself) don't pull TipTap/ProseMirror into their bundle — that file's default export drags in
// ~13 @tiptap/* packages, which is a meaningful chunk of the Email Panel's Script Evaluation
// time (see the compose editor's own dynamic() import). This function has no editor dependency.
export function printComposeContent(subject: string, htmlBody: string) {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return;
  const safeTitle = subject.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>
  <style>body{font-family:system-ui,sans-serif;padding:24px;color:#1E1B2E;} @media print { body { padding: 12px; } }</style>
  </head><body><div>${htmlBody || "<p></p>"}</div></body></html>`);
  w.document.close();
  w.focus();
  requestAnimationFrame(() => {
    w.print();
  });
}
