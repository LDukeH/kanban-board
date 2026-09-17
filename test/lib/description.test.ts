import { describe, expect, it } from "vitest";
import {
  descriptionsEqual,
  getDescriptionPreview,
  isTaskDescriptionDoc,
  isEmptyDescription,
  textToTaskDescription,
  type TaskDescription,
} from "@/lib/description";

describe("isTaskDescriptionDoc", () => {
  it("accepts doc-shaped objects", () => {
    expect(isTaskDescriptionDoc({ type: "doc" })).toBe(true);
    expect(isTaskDescriptionDoc({ type: "doc", content: [] })).toBe(true);
    expect(isTaskDescriptionDoc({ type: "doc", content: [{}] })).toBe(true);
  });

  it("rejects non-doc values", () => {
    expect(isTaskDescriptionDoc(null)).toBe(false);
    expect(isTaskDescriptionDoc(undefined)).toBe(false);
    expect(isTaskDescriptionDoc("hello")).toBe(false);
    expect(isTaskDescriptionDoc(42)).toBe(false);
    expect(isTaskDescriptionDoc({ content: [] })).toBe(false);
    expect(isTaskDescriptionDoc({ type: "paragraph", content: [] })).toBe(false);
  });

  it("requires content to be an array when present", () => {
    expect(isTaskDescriptionDoc({ type: "doc", content: "not-an-array" })).toBe(false);
    expect(isTaskDescriptionDoc({ type: "doc", content: null })).toBe(false);
  });
});

describe("getDescriptionPreview", () => {
  it("returns an empty string for nullish input", () => {
    expect(getDescriptionPreview(null)).toBe("");
    expect(getDescriptionPreview(undefined)).toBe("");
  });

  it("returns the trimmed text for legacy string rows", () => {
    expect(getDescriptionPreview("  plain text  ")).toBe("plain text");
  });

  it("deep-walks doc content and collapses whitespace", () => {
    const doc: TaskDescription = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }, { type: "text", text: " world" }],
        },
        { type: "heading", content: [{ type: "text", text: "  done  " }] },
      ],
    };
    expect(getDescriptionPreview(doc)).toBe("Hello world done");
  });

  it("returns an empty string for empty docs and malformed objects", () => {
    expect(getDescriptionPreview({ type: "doc", content: [] })).toBe("");
    expect(getDescriptionPreview({ type: "doc", content: [{ type: "paragraph" }] })).toBe("");
    expect(getDescriptionPreview({ type: "unknown" } as unknown as TaskDescription)).toBe("");
  });
});

describe("textToTaskDescription", () => {
  it("wraps trimmed text in a single paragraph", () => {
    expect(textToTaskDescription("  hello  ")).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
    });
  });

  it("returns an empty doc for blank text", () => {
    expect(textToTaskDescription("")).toEqual({ type: "doc", content: [] });
    expect(textToTaskDescription("   ")).toEqual({ type: "doc", content: [] });
  });
});

describe("isEmptyDescription", () => {
  it("is true for nullish, blank, and empty docs", () => {
    expect(isEmptyDescription(undefined)).toBe(true);
    expect(isEmptyDescription("")).toBe(true);
    expect(isEmptyDescription("   ")).toBe(true);
    expect(isEmptyDescription({ type: "doc", content: [] })).toBe(true);
  });

  it("is false for actual content", () => {
    expect(isEmptyDescription("x")).toBe(false);
    expect(isEmptyDescription(textToTaskDescription("x"))).toBe(false);
  });
});

describe("descriptionsEqual", () => {
  it("compares string values directly", () => {
    expect(descriptionsEqual("a", "a")).toBe(true);
    expect(descriptionsEqual("a", "b")).toBe(false);
  });

  it("treats nullish values as equal", () => {
    expect(descriptionsEqual(undefined, undefined)).toBe(true);
    expect(descriptionsEqual(null, undefined)).toBe(true);
    expect(descriptionsEqual(null, null)).toBe(true);
  });

  it("compares doc structures structurally", () => {
    const a: TaskDescription = { type: "doc", content: [{ type: "text", text: "x" }] };
    const same: TaskDescription = { type: "doc", content: [{ type: "text", text: "x" }] };
    const different: TaskDescription = { type: "doc", content: [] };
    expect(descriptionsEqual(a, same)).toBe(true);
    expect(descriptionsEqual(a, different)).toBe(false);
  });

  it("never considers a string equal to a doc", () => {
    expect(descriptionsEqual("x", { type: "doc", content: [] })).toBe(false);
  });
});