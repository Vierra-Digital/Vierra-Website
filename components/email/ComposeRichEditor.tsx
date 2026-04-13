"use client";

import React, { useCallback, useEffect, useImperativeHandle, useMemo, forwardRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import FontFamily from "@tiptap/extension-font-family";
import { FiBold, FiItalic, FiLink2, FiImage, FiList, FiMinus } from "react-icons/fi";

export type ComposeRichEditorHandle = {
  focus: () => void;
  promptInsertLink: () => void;
  promptInsertImage: () => void;
};

type Props = {
  valueHtml: string;
  onChange: (payload: { html: string; text: string }) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  minHeightClass?: string;
  showToolbar?: boolean;
};

const FONT_OPTIONS = [
  { label: "Default", value: "" },
  { label: "Sans", value: "ui-sans-serif, system-ui, sans-serif" },
  { label: "Serif", value: "ui-serif, Georgia, serif" },
  { label: "Mono", value: "ui-monospace, monospace" },
];

const COMPOSE_EDITOR_SCROLL =
  "[scrollbar-width:thin] [scrollbar-color:rgb(203_213_225)_rgb(241_245_249)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb:hover]:bg-slate-400";

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 min-w-[28px] shrink-0 items-center justify-center rounded px-1.5 text-[13px] font-medium ${
        active ? "bg-[#e8eaed] text-[#202124]" : "text-[#5f6368] hover:bg-[#f1f3f4]"
      } disabled:pointer-events-none disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function setLink(editor: Editor) {
  const previous = editor.getAttributes("link").href as string | undefined;
  const url = window.prompt("Link URL", previous || "https://");
  if (url === null) return;
  const trimmed = url.trim();
  if (trimmed === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
}

function insertImage(editor: Editor) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) return;
      editor.chain().focus().setImage({ src, alt: file.name }).run();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

const ComposeRichEditor = forwardRef<ComposeRichEditorHandle, Props>(function ComposeRichEditor(
  {
    valueHtml,
    onChange,
    placeholder = "",
    className = "",
    editorClassName = "",
    minHeightClass = "min-h-[140px]",
    showToolbar = true,
  },
  ref
) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
          class: "text-[#1a73e8] underline",
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
      Image.configure({ allowBase64: true, inline: false }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: valueHtml || "<p></p>",
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none text-[#202124] ${editorClassName}`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange({ html: ed.getHTML(), text: ed.getText() });
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = valueHtml && valueHtml.trim() ? valueHtml : "<p></p>";
    if (next === current) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, valueHtml]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.chain().focus().run(),
      promptInsertLink: () => editor && setLink(editor),
      promptInsertImage: () => editor && insertImage(editor),
    }),
    [editor]
  );

  const chain = useCallback(() => editor?.chain().focus(), [editor]);

  if (!editor) {
    return (
      <div className={`rounded-md border border-[#e8eaed] bg-white ${minHeightClass} ${className}`}>
        <div className="p-3 text-sm text-[#70757a]">Loading editor…</div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-md border border-[#e8eaed] bg-white ${className}`}>
      <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${COMPOSE_EDITOR_SCROLL} ${minHeightClass}`}>
        <EditorContent editor={editor} className="min-h-0 flex-1 px-3 py-2 [&_.ProseMirror]:h-full [&_.ProseMirror]:outline-none" />
      </div>
      {showToolbar ? (
        <div
          className="flex flex-wrap items-center gap-0.5 border-t border-[#e8eaed] bg-[#f8f9fa] px-1.5 py-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          <select
            className="mr-1 max-h-8 rounded border border-transparent bg-transparent px-1 text-xs text-[#202124] hover:border-[#dadce0]"
            value={
              editor.isActive("heading", { level: 1 })
                ? "h1"
                : editor.isActive("heading", { level: 2 })
                  ? "h2"
                  : editor.isActive("heading", { level: 3 })
                    ? "h3"
                    : "p"
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === "p") chain()?.setParagraph().run();
              else if (v === "h1") chain()?.toggleHeading({ level: 1 }).run();
              else if (v === "h2") chain()?.toggleHeading({ level: 2 }).run();
              else if (v === "h3") chain()?.toggleHeading({ level: 3 }).run();
            }}
            aria-label="Block style"
          >
            <option value="p">Normal</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
          </select>

          <select
            className="mr-1 max-h-8 max-w-[7rem] rounded border border-transparent bg-transparent px-1 text-xs text-[#202124] hover:border-[#dadce0]"
            value={(editor.getAttributes("textStyle").fontFamily as string) || ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) chain()?.unsetFontFamily().run();
              else chain()?.setFontFamily(v).run();
            }}
            aria-label="Font"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => chain()?.toggleBold().run()}>
            <FiBold className="h-4 w-4" aria-hidden />
          </ToolbarButton>
          <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => chain()?.toggleItalic().run()}>
            <FiItalic className="h-4 w-4" aria-hidden />
          </ToolbarButton>
          <ToolbarButton
            title="Underline"
            active={editor.isActive("underline")}
            onClick={() => chain()?.toggleUnderline().run()}
          >
            <span className="text-sm font-semibold underline">U</span>
          </ToolbarButton>
          <ToolbarButton title="Strikethrough" active={editor.isActive("strike")} onClick={() => chain()?.toggleStrike().run()}>
            <span className="text-sm line-through">S</span>
          </ToolbarButton>

          <span className="mx-0.5 inline-block h-5 w-px shrink-0 bg-[#dadce0]" aria-hidden />

          <input
            type="color"
            title="Text color"
            aria-label="Text color"
            className="h-7 w-8 cursor-pointer overflow-hidden rounded border-0 bg-transparent p-0"
            value={(editor.getAttributes("textStyle").color as string) || "#202124"}
            onChange={(e) => chain()?.setColor(e.target.value).run()}
          />
          <input
            type="color"
            title="Highlight"
            aria-label="Highlight"
            className="h-7 w-8 cursor-pointer overflow-hidden rounded border-0 bg-transparent p-0"
            value={(editor.getAttributes("highlight").color as string) || "#fff59d"}
            onChange={(e) => chain()?.toggleHighlight({ color: e.target.value }).run()}
          />

          <span className="mx-0.5 inline-block h-5 w-px shrink-0 bg-[#dadce0]" aria-hidden />

          <ToolbarButton title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => chain()?.setTextAlign("left").run()}>
            <span className="text-xs font-semibold">L</span>
          </ToolbarButton>
          <ToolbarButton
            title="Align center"
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => chain()?.setTextAlign("center").run()}
          >
            <span className="text-xs font-semibold">C</span>
          </ToolbarButton>
          <ToolbarButton title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => chain()?.setTextAlign("right").run()}>
            <span className="text-xs font-semibold">R</span>
          </ToolbarButton>

          <span className="mx-0.5 inline-block h-5 w-px shrink-0 bg-[#dadce0]" aria-hidden />

          <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => chain()?.toggleBulletList().run()}>
            <FiList className="h-4 w-4" aria-hidden />
          </ToolbarButton>
          <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => chain()?.toggleOrderedList().run()}>
            <span className="text-xs font-semibold">1.</span>
          </ToolbarButton>
          <ToolbarButton title="Horizontal rule" onClick={() => chain()?.setHorizontalRule().run()}>
            <FiMinus className="h-4 w-4" aria-hidden />
          </ToolbarButton>

          <span className="mx-0.5 inline-block h-5 w-px shrink-0 bg-[#dadce0]" aria-hidden />

          <ToolbarButton title="Link" active={editor.isActive("link")} onClick={() => setLink(editor)}>
            <FiLink2 className="h-4 w-4" aria-hidden />
          </ToolbarButton>
          <ToolbarButton title="Insert image" onClick={() => insertImage(editor)}>
            <FiImage className="h-4 w-4" aria-hidden />
          </ToolbarButton>

          <span className="mx-0.5 inline-block h-5 w-px shrink-0 bg-[#dadce0]" aria-hidden />

          <ToolbarButton title="Undo" onClick={() => chain()?.undo().run()}>
            <span className="text-xs">↶</span>
          </ToolbarButton>
          <ToolbarButton title="Redo" onClick={() => chain()?.redo().run()}>
            <span className="text-xs">↷</span>
          </ToolbarButton>
        </div>
      ) : null}
    </div>
  );
});

export default ComposeRichEditor;

export function printComposeContent(subject: string, htmlBody: string) {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return;
  const safeTitle = subject.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${safeTitle}</title>
  <style>body{font-family:system-ui,sans-serif;padding:24px;color:#202124;} @media print { body { padding: 12px; } }</style>
  </head><body><div>${htmlBody || "<p></p>"}</div></body></html>`);
  w.document.close();
  w.focus();
  requestAnimationFrame(() => {
    w.print();
  });
}
