import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Pilcrow,
  Quote,
  SquareCode,
  Strikethrough,
  Underline,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskRichTextToolbarProps {
  editor: Editor | null;
  onBeforeAction?: () => void;
}

function ToolbarButton({
  active,
  title,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function TaskRichTextToolbar({ editor, onBeforeAction }: TaskRichTextToolbarProps) {
  if (!editor) return null;
  const snapshot = () => onBeforeAction?.();
  const focusChain = () => editor.chain().focus();
  const act = (apply: () => unknown) => () => {
    snapshot();
    apply();
  };
  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5"
      role="toolbar"
      aria-label="Description formatting"
    >
      <ToolbarButton label="Paragraph" title="Paragraph" active={editor.isActive("paragraph")} onClick={act(() => focusChain().setNode('paragraph').run())}>
        <Pilcrow className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Heading 1" title="Heading 1 (# )" active={editor.isActive("heading", { level: 1 })} onClick={act(() => focusChain().toggleHeading({ level: 1 }).run())}>
        <Heading1 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Heading 2" title="Heading 2 (## )" active={editor.isActive("heading", { level: 2 })} onClick={act(() => focusChain().toggleHeading({ level: 2 }).run())}>
        <Heading2 className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Heading 3" title="Heading 3 (### )" active={editor.isActive("heading", { level: 3 })} onClick={act(() => focusChain().toggleHeading({ level: 3 }).run())}>
        <Heading3 className="size-3.5" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton label="Bold" title="Bold" active={editor.isActive("bold")} onClick={act(() => focusChain().toggleBold().run())}>
        <Bold className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Italic" title="Italic" active={editor.isActive("italic")} onClick={act(() => focusChain().toggleItalic().run())}>
        <Italic className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" title="Strikethrough" active={editor.isActive("strike")} onClick={act(() => focusChain().toggleStrike().run())}>
        <Strikethrough className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Underline" title="Underline" active={editor.isActive("underline")} onClick={act(() => focusChain().toggleUnderline().run())}>
        <Underline className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Inline code" title="Inline code" active={editor.isActive("code")} onClick={act(() => focusChain().toggleCode().run())}>
        <Code className="size-3.5" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton label="Bullet list" title="Bullet list (- )" active={editor.isActive("bulletList")} onClick={act(() => focusChain().toggleBulletList().run())}>
        <List className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Ordered list" title="Ordered list (1. )" active={editor.isActive("orderedList")} onClick={act(() => focusChain().toggleOrderedList().run())}>
        <ListOrdered className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Task list" title="Task list ([ ] )" active={editor.isActive("taskList")} onClick={act(() => focusChain().toggleTaskList().run())}>
        <ListTodo className="size-3.5" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton label="Link" title="Link" active={editor.isActive("link")} onClick={() => {
        const previous = editor.getAttributes("link").href as string | undefined;
        const url = window.prompt("Link URL", previous ?? "https://");
        snapshot();
        if (url === null) return;
        if (url.trim() === "") { focusChain().unsetLink().run(); return; }
        focusChain().setLink({ href: url.trim() }).run();
      }}>
        <LinkIcon className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Image" title="Image (URL)" onClick={() => {
        const url = window.prompt("Image URL", "https://");
        if (!url || url.trim() === "") return;
        snapshot();
        focusChain().setImage({ src: url.trim() }).run();
      }}>
        <ImageIcon className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Horizontal rule" title="Horizontal rule (---)" onClick={act(() => focusChain().setHorizontalRule().run())}>
        <Minus className="size-3.5" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton label="Quote" title="Quote (> )" active={editor.isActive("blockquote")} onClick={act(() => focusChain().toggleBlockquote().run())}>
        <Quote className="size-3.5" />
      </ToolbarButton>
      <ToolbarButton label="Code block" title="Code block" active={editor.isActive("codeBlock")} onClick={act(() => focusChain().toggleCodeBlock().run())}>
        <SquareCode className="size-3.5" />
      </ToolbarButton>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-border" aria-hidden />;
}
