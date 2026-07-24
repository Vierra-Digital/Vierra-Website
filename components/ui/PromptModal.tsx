import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * A styled replacement for window.prompt — one or more fields in an apparent modal dialog.
 * Supports plain text, a longer textarea, and a color input (with a swatch), so it covers
 * label/signature/template names, link URLs, tag name+color, and AI intents in one component.
 */
export type PromptField = {
  name: string;
  label?: string;
  type?: "text" | "textarea" | "color";
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
};

type PromptModalProps = {
  open: boolean;
  title: string;
  description?: string;
  fields: PromptField[];
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (values: Record<string, string>) => void;
};

const PromptModal: React.FC<PromptModalProps> = ({
  open,
  title,
  description,
  fields,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  busy = false,
  onCancel,
  onSubmit,
}) => {
  const initial = useMemo(() => {
    const seed: Record<string, string> = {};
    for (const f of fields) seed[f.name] = f.defaultValue ?? (f.type === "color" ? "#701CC0" : "");
    return seed;
  }, [fields]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const firstFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const wasOpen = useRef(false);

  // Reset the fields only on an actual closed→open transition — NOT on every parent re-render.
  // (Callers pass `fields` as a fresh array literal, so `initial`'s identity changes each render;
  // resetting on that would wipe whatever the user is typing.)
  useEffect(() => {
    if (open && !wasOpen.current) setValues(initial);
    wasOpen.current = open;
  }, [open, initial]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstFieldRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const missingRequired = fields.some((f) => f.required && !String(values[f.name] ?? "").trim());

  const submit = () => {
    if (busy || missingRequired) return;
    const trimmed: Record<string, string> = {};
    for (const f of fields) trimmed[f.name] = String(values[f.name] ?? "").trim();
    onSubmit(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#14101E]/55"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white border border-[#EBEAF0] shadow-[0_28px_70px_-24px_rgba(20,16,40,0.45)] p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold tracking-tight text-[#1E1B2E]">{title}</h3>
        {description ? <p className="mt-1 text-sm text-[#6B7280]">{description}</p> : null}

        <div className="mt-4 space-y-4">
          {fields.map((field, index) => (
            <div key={field.name}>
              {field.label ? (
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#847FA0]">{field.label}</label>
              ) : null}
              {field.type === "textarea" ? (
                <textarea
                  ref={index === 0 ? (el) => { firstFieldRef.current = el; } : undefined}
                  value={values[field.name] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  rows={4}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1E1B2E] outline-none transition focus:border-[#701CC0] focus:ring-2 focus:ring-[#701CC0]/20"
                />
              ) : field.type === "color" ? (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(values[field.name] ?? "") ? values[field.name] : "#701CC0"}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white p-1"
                  />
                  <input
                    type="text"
                    value={values[field.name] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                    placeholder={field.placeholder || "#701CC0"}
                    maxLength={field.maxLength ?? 9}
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1E1B2E] outline-none transition focus:border-[#701CC0] focus:ring-2 focus:ring-[#701CC0]/20"
                  />
                </div>
              ) : (
                <input
                  ref={index === 0 ? (el) => { firstFieldRef.current = el; } : undefined}
                  type="text"
                  value={values[field.name] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                    if (e.key === "Escape" && !busy) onCancel();
                  }}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#1E1B2E] outline-none transition focus:border-[#701CC0] focus:ring-2 focus:ring-[#701CC0]/20"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#374151] transition hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || missingRequired}
            className="rounded-lg bg-[#701CC0] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5f17a5] disabled:opacity-50"
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptModal;
