"use client";

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState, forwardRef } from "react";
import PromptModal from "@/components/ui/PromptModal";
import { COMPOSE_NEUTRAL_SCROLLBAR } from "@/components/email/constants";
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
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { FiBold, FiItalic, FiLink2, FiImage, FiList, FiMinus, FiGrid, FiTrash2 } from "react-icons/fi";

/**
 * Image with drag-to-resize. Adds a `width` attribute that serializes to an inline
 * `style` (inline styles are required for images to render correctly in emails) and a
 * NodeView that shows a corner handle on hover for resizing.
 */
const toPx = (w: unknown) => (typeof w === "number" ? `${w}px` : typeof w === "string" && w ? w : "");

const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.style.width || el.getAttribute("width") || null,
        renderHTML: (attrs: { width?: string | number | null }) =>
          attrs.width ? { style: `width: ${toPx(attrs.width)}; max-width: 100%; height: auto;` } : {},
      },
    };
  },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      const container = document.createElement("div");
      container.style.cssText = "position:relative;display:inline-block;max-width:100%;line-height:0;";

      const img = document.createElement("img");
      img.src = node.attrs.src;
      if (node.attrs.alt) img.alt = node.attrs.alt;
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      if (node.attrs.width) img.style.width = toPx(node.attrs.width);
      container.appendChild(img);

      const handle = document.createElement("span");
      handle.contentEditable = "false";
      handle.style.cssText =
        "position:absolute;right:-5px;bottom:-5px;width:12px;height:12px;background:#701CC0;border:2px solid #fff;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.25);cursor:nwse-resize;opacity:0;transition:opacity .12s;";
      container.appendChild(handle);
      container.addEventListener("mouseenter", () => (handle.style.opacity = "1"));
      container.addEventListener("mouseleave", () => { if (!resizing) handle.style.opacity = "0"; });

      let resizing = false;
      let startX = 0;
      let startWidth = 0;
      const onMove = (e: MouseEvent) => {
        if (!resizing) return;
        const max = container.parentElement?.clientWidth || 800;
        const next = Math.max(40, Math.min(startWidth + (e.clientX - startX), max));
        img.style.width = `${Math.round(next)}px`;
      };
      const onUp = () => {
        if (!resizing) return;
        resizing = false;
        handle.style.opacity = "0";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        if (typeof getPos !== "function") return;
        const pos = getPos();
        if (pos == null) return;
        const current = editor.state.doc.nodeAt(pos);
        if (!current) return;
        const width = Math.round(img.getBoundingClientRect().width);
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, width })
        );
      };
      const onDown = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        startX = e.clientX;
        startWidth = img.getBoundingClientRect().width;
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      };
      handle.addEventListener("mousedown", onDown);

      return {
        dom: container,
        update: (updated) => {
          if (updated.type.name !== node.type.name) return false;
          if (updated.attrs.src !== img.src) img.src = updated.attrs.src;
          img.style.width = updated.attrs.width ? toPx(updated.attrs.width) : "";
          return true;
        },
        destroy: () => {
          handle.removeEventListener("mousedown", onDown);
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        },
      };
    };
  },
});

export type ComposeRichEditorHandle = {
  focus: () => void;
  promptInsertLink: () => void;
  promptInsertImage: () => void;
  /** Insert a hyperlink with explicit URL + visible text at the cursor. */
  insertLink: (url: string, text: string) => void;
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
        active ? "bg-[#EAE5F4] text-[#1E1B2E]" : "text-[#4A465C] hover:bg-[#F5EFFF]"
      } disabled:pointer-events-none disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function applyLinkToEditor(editor: Editor, rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (trimmed === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  // Reject unsafe schemes (javascript:, data:, file:, …). A scheme-less value like "example.com"
  // passes through — the Link extension + send-time sanitizer handle it. Defense in depth.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^(https?|mailto):/i.test(trimmed)) {
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
          class: "text-[#701CC0] underline",
        },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
      ResizableImage.configure({ allowBase64: true, inline: false }),
      Table.configure({ resizable: true, HTMLAttributes: { style: "border-collapse:collapse;width:100%;margin:8px 0;" } }),
      TableRow,
      TableHeader.configure({ HTMLAttributes: { style: "border:1px solid #DEC9F6;background:#F5EFFF;padding:6px 8px;font-weight:600;text-align:left;" } }),
      TableCell.configure({ HTMLAttributes: { style: "border:1px solid #DEC9F6;padding:6px 8px;vertical-align:top;" } }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: valueHtml || "<p></p>",
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none text-[#1E1B2E] ${editorClassName}`,
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

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkInitial, setLinkInitial] = useState("https://");

  const openLinkModal = useCallback(() => {
    if (!editor) return;
    const previous = (editor.getAttributes("link").href as string | undefined) || "https://";
    setLinkInitial(previous);
    setLinkModalOpen(true);
  }, [editor]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.chain().focus().run(),
      promptInsertLink: () => openLinkModal(),
      promptInsertImage: () => editor && insertImage(editor),
      insertLink: (url: string, text: string) => {
        if (!editor || !url) return;
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text || url)}</a>&nbsp;`)
          .run();
      },
    }),
    [editor, openLinkModal]
  );

  const chain = useCallback(() => editor?.chain().focus(), [editor]);

  if (!editor) {
    return (
      <div className={`rounded-md border border-[#EAE5F4] bg-white ${minHeightClass} ${className}`}>
        <div className="p-3 text-sm text-[#847FA0]">Loading editor…</div>
      </div>
    );
  }

  return (
    <>
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-md border border-[#EAE5F4] bg-white ${className}`}>
      <div className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${COMPOSE_NEUTRAL_SCROLLBAR} ${minHeightClass}`}>
        <EditorContent editor={editor} className="min-h-0 flex-1 px-3 py-2 [&_.ProseMirror]:min-h-[inherit] [&_.ProseMirror]:outline-none" />
      </div>
      {showToolbar ? (
        <div
          className="flex flex-wrap items-center gap-0.5 border-t border-[#EAE5F4] bg-[#F6F3FD] px-1.5 py-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          <select
            className="mr-1 max-h-8 rounded border border-transparent bg-transparent px-1 text-xs text-[#1E1B2E] hover:border-[#DEC9F6]"
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
            className="mr-1 max-h-8 max-w-[7rem] rounded border border-transparent bg-transparent px-1 text-xs text-[#1E1B2E] hover:border-[#DEC9F6]"
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

          <span className="mx-0.5 inline-block h-5 w-px shrink-0 bg-[#DEC9F6]" aria-hidden />

          <input
            type="color"
            title="Text color"
            aria-label="Text color"
            className="h-7 w-8 cursor-pointer overflow-hidden rounded border-0 bg-transparent p-0"
            value={(editor.getAttributes("textStyle").color as string) || "#1E1B2E"}
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

          <span className="mx-0.5 inline-block h-5 w-px shrink-0 bg-[#DEC9F6]" aria-hidden />

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

          <span className="mx-0.5 inline-block h-5 w-px shrink-0 bg-[#DEC9F6]" aria-hidden />

          <ToolbarButton title="Bullet list" active={editor.isActive("bulletList")} onClick={() => chain()?.toggleBulletList().run()}>
            <FiList className="h-4 w-4" aria-hidden />
          </ToolbarButton>
          <ToolbarButton title="Numbered list" active={editor.isActive("orderedList")} onClick={() => chain()?.toggleOrderedList().run()}>
            <span className="text-xs font-semibold">1.</span>
          </ToolbarButton>
          <ToolbarButton title="Horizontal rule" onClick={() => chain()?.setHorizontalRule().run()}>
            <FiMinus className="h-4 w-4" aria-hidden />
          </ToolbarButton>

          <span className="mx-0.5 inline-block h-5 w-px shrink-0 bg-[#DEC9F6]" aria-hidden />

          <ToolbarButton title="Link" active={editor.isActive("link")} onClick={() => openLinkModal()}>
            <FiLink2 className="h-4 w-4" aria-hidden />
          </ToolbarButton>
          <ToolbarButton title="Insert image" onClick={() => insertImage(editor)}>
            <FiImage className="h-4 w-4" aria-hidden />
          </ToolbarButton>
          <ToolbarButton title="Insert table" onClick={() => chain()?.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <FiGrid className="h-4 w-4" aria-hidden />
          </ToolbarButton>
          {editor.isActive("table") ? (
            <>
              <ToolbarButton title="Add column" onClick={() => chain()?.addColumnAfter().run()}>
                <span className="text-xs font-semibold">+Col</span>
              </ToolbarButton>
              <ToolbarButton title="Add row" onClick={() => chain()?.addRowAfter().run()}>
                <span className="text-xs font-semibold">+Row</span>
              </ToolbarButton>
              <ToolbarButton title="Delete table" onClick={() => chain()?.deleteTable().run()}>
                <FiTrash2 className="h-4 w-4" aria-hidden />
              </ToolbarButton>
            </>
          ) : null}

          <span className="mx-0.5 inline-block h-5 w-px shrink-0 bg-[#DEC9F6]" aria-hidden />

          <ToolbarButton title="Undo" onClick={() => chain()?.undo().run()}>
            <span className="text-xs">↶</span>
          </ToolbarButton>
          <ToolbarButton title="Redo" onClick={() => chain()?.redo().run()}>
            <span className="text-xs">↷</span>
          </ToolbarButton>
        </div>
      ) : null}
    </div>
      <PromptModal
        open={linkModalOpen}
        title="Insert link"
        description="Add a link to the selected text. Leave the field empty to remove an existing link."
        fields={[{ name: "url", type: "text", placeholder: "https://example.com", defaultValue: linkInitial }]}
        confirmLabel="Apply link"
        onCancel={() => setLinkModalOpen(false)}
        onSubmit={(values) => {
          if (editor) applyLinkToEditor(editor, values.url);
          setLinkModalOpen(false);
        }}
      />
    </>
  );
});

export default ComposeRichEditor;
