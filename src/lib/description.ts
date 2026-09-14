/**
 * Canonical task description format.
 *
 * Descriptions are stored and presented as Tiptap JSON documents, persisted
 * as PostgreSQL JSONB on the backend. We never persist HTML strings.
 *
 * During the backend transition `Task.description` is typed as
 * `TaskDescription | string` so legacy plain-text rows keep rendering.
 * After the backend migration lands this tightens to JSON-only.
 */

export interface TipTapJSONMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapJSONNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapJSONNode[];
  marks?: TipTapJSONMark[];
  text?: string;
}

export interface TaskDescription {
  type: "doc";
  content?: TipTapJSONNode[];
}

/** Raw description shape accepted from the API (JSON doc, legacy text, null). */
export type RawTaskDescription = TaskDescription | string | null | undefined;

export function isTaskDescriptionDoc(
  value: unknown,
): value is TaskDescription {
  if (typeof value !== "object" || value === null) return false;
  const doc = value as { type?: unknown; content?: unknown };
  return doc.type === "doc" && (doc.content === undefined || Array.isArray(doc.content));
}

function collectText(nodes: TipTapJSONNode[] | undefined, out: string[]): void {
  if (!nodes) return;
  for (const node of nodes) {
    if (typeof node.text === "string") out.push(node.text);
    if (node.content) collectText(node.content, out);
  }
}

/**
 * Plain-text preview of a description for card/list rendering.
 * Deep-walks Tiptap JSON; falls back to the raw string for legacy rows.
 */
export function getDescriptionPreview(description: RawTaskDescription): string {
  if (!description) return "";
  if (typeof description === "string") return description.trim();
  if (isTaskDescriptionDoc(description)) {
    const parts: string[] = [];
    collectText(description.content, parts);
    return parts.join(" ").replace(/\s+/g, " ").trim();
  }
  return "";
}

/** Wrap plain text in a single-paragraph Tiptap doc (quick-create path). */
export function textToTaskDescription(text: string): TaskDescription {
  const trimmed = text.trim();
  if (!trimmed) return { type: "doc", content: [] };
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: trimmed }] }],
  };
}

export function isEmptyDescription(description: RawTaskDescription): boolean {
  return getDescriptionPreview(description).length === 0;
}

/** Structural equality for dirty-state checks (stable for Tiptap output). */
export function descriptionsEqual(
  a: RawTaskDescription,
  b: RawTaskDescription,
): boolean {
  if (typeof a === "string" || typeof b === "string") return (a ?? "") === (b ?? "");
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
