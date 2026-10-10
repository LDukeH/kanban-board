import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
import Heading from "@tiptap/extension-heading";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import Blockquote from "@tiptap/extension-blockquote";
import CodeBlock from "@tiptap/extension-code-block";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import HardBreak from "@tiptap/extension-hard-break";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import History from "@tiptap/extension-history";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { TaskDescription } from "@/lib/description";
import { getDescriptionPreview, textToTaskDescription } from "@/lib/description";
import { TaskRichTextToolbar } from "@/components/task/TaskRichTextToolbar";

const EMPTY_DOC: TaskDescription = { type: "doc" };

function normalizeDoc(description: TaskDescription | undefined): TaskDescription {
  if (description && description.type === "doc") return description;
  return EMPTY_DOC;
}

/**
 * Normalizes editor JSON to the dialog's draft shape (same as
 * normalizeSnapshotDescription): Tiptap re-serializes docs with empty
 * paragraphs, so seeding/capturing raw JSON would flag a clean dialog dirty.
 */
function toDraftDoc(doc: TaskDescription | undefined): TaskDescription | undefined {
  const preview = getDescriptionPreview(doc);
  return preview ? textToTaskDescription(preview) : undefined;
}

interface TaskDescriptionEditorProps {
  /** Saved description snapshot (drives the read-only render). */
  description: TaskDescription | undefined;
  // Draft setter owned by the modal; called only on explicit save/flush, never on keystroke, so typing never fires API requests.
  draftDescription: TaskDescription | undefined;
  onDraftChange: (doc: TaskDescription) => void;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  disabled?: boolean;
}

export function TaskDescriptionEditor({
  description,
  draftDescription,
  onDraftChange,
  editing,
  onEditingChange,
  disabled = false,
}: TaskDescriptionEditorProps) {
  const onDraftChangeRef = useRef(onDraftChange);
  const lastSeedRef = useRef<TaskDescription | undefined>(undefined);
  useEffect(() => {
    onDraftChangeRef.current = onDraftChange;
  }, [onDraftChange]);

  const editor: Editor | null = useEditor(
    {
      extensions: [
        // Explicit extension set (no StarterKit meta-package) so the bundle ships only what the description editor needs.
        Document,
        Paragraph,
        Text,
        History,
        Heading.configure({ levels: [1, 2, 3] }),
        BulletList,
        OrderedList,
        ListItem,
        TaskList,
        TaskItem.configure({ nested: true }),
        Bold,
        Italic,
        Strike,
        Code,
        Underline,
        Link.configure({ openOnClick: false, autolink: true }),
        Blockquote,
        CodeBlock,
        HorizontalRule,
        HardBreak,
        Image,
        Dropcursor,
        Gapcursor,
      ],
      content: normalizeDoc(draftDescription ?? description),
      editable: editing && !disabled,
      onUpdate: ({ editor: updated }) => {
        const next = updated.getJSON() as TaskDescription;
        onDraftChangeRef.current(
          (toDraftDoc(next) ?? normalizeDoc(description)) as TaskDescription,
        );
      },
      editorProps: {
        attributes: {
          class: "task-description-prose focus:outline-none",
          "aria-label": "Task description",
        },
      },
  // The draft is captured via onUpdate into the modal's state; only explicit Save / close-flush PATCHes, so typing never hits the API.
    },
    [],
  );

  // Swap the load-bearing snapshot without disturbing an in-progress draft: re-seeding while editing would discard keystrokes.
  useEffect(() => {
    if (!editor || editing) return;
    const seed = normalizeDoc(description);
    lastSeedRef.current = seed;
    editor.commands.setContent(seed, { emitUpdate: false });
  }, [editor, editing, description]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editing && !disabled);
    if (editing && !disabled) {
      // Focus at end so click-to-edit feels like continuing the text.
      const t = window.setTimeout(() => editor.commands.focus("end"), 0);
      return () => window.clearTimeout(t);
    }
  }, [editor, editing, disabled]);

  function handleEnterEdit() {
    if (disabled) return;
    // Seed the draft with the current content on entry; a no-op unless the user previously cancelled.
    if (editor) {
      const seed = editor.getJSON() as TaskDescription;
      onDraftChangeRef.current(
        (toDraftDoc(seed) ?? normalizeDoc(description)) as TaskDescription,
      );
    }
    onEditingChange(true);
  }

  function handleCaptureDraft() {
    if (editor) {
      const captured = editor.getJSON() as TaskDescription;
      onDraftChangeRef.current(
        (toDraftDoc(captured) ?? normalizeDoc(description)) as TaskDescription,
      );
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg transition-colors",
        editing
          ? "border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
          : "border border-transparent hover:border-input",
      )}
    >
      {editing && !disabled && (
        <TaskRichTextToolbar editor={editor} onBeforeAction={handleCaptureDraft} />
      )}
      {editing ? (
        <EditorContent editor={editor} className="min-h-24 px-3 py-2" />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={handleEnterEdit}
          className="block w-full cursor-text px-1 py-1 text-left"
          aria-label="Edit description"
        >
          <EditorContent editor={editor} className="pointer-events-none" />
        </button>
      )}
    </div>
  );
}
