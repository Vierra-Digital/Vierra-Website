import Modal from "@/components/ui/Modal";

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "c", label: "Compose" },
  { keys: "e", label: "Archive" },
  { keys: "# / ⌫", label: "Trash" },
  { keys: "r", label: "Reply" },
  { keys: "a", label: "Reply all" },
  { keys: "f", label: "Forward" },
  { keys: "s", label: "Star / unstar" },
  { keys: "Shift+I", label: "Mark as read" },
  { keys: "Shift+U", label: "Mark as unread" },
  { keys: "Esc", label: "Close the open message" },
  { keys: "?", label: "Show this list" },
];

/** Gmail-style keyboard shortcut cheat sheet — the panel has no other way to discover these. */
export default function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      onClose={onClose}
      zIndexClass="z-[200]"
      backdropClassName="bg-black/50 backdrop-blur-sm"
      cardClassName="email-dialog-dark rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
      label="Keyboard shortcuts"
      closeOnBackdrop
      closeOnEscape
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: "var(--mail-text)" }}>
          Keyboard shortcuts
        </h3>
        <button type="button" onClick={onClose} aria-label="Close" style={{ color: "var(--mail-text-muted)" }}>
          ✕
        </button>
      </div>
      <dl className="space-y-2">
        {SHORTCUTS.map((s) => (
          <div key={s.label} className="flex items-center justify-between gap-4 text-sm">
            <dt style={{ color: "var(--mail-text-muted)" }}>{s.label}</dt>
            <dd>
              <kbd
                className="rounded border px-1.5 py-0.5 font-mono text-xs"
                style={{ borderColor: "var(--mail-border)", color: "var(--mail-text)" }}
              >
                {s.keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs" style={{ color: "var(--mail-text-muted)" }}>
        Shortcuts are disabled while typing in a text field, search box, or the compose editor.
      </p>
    </Modal>
  );
}
