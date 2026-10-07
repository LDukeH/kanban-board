import { describe, expect, it } from "vitest";
import { textToTaskDescription } from "@/lib/description";
import {
  buildTaskUpdatePayload,
  createTaskDraft,
  isTaskDraftDirty,
  resolveCloseAction,
  validateTaskDraft,
} from "@/lib/taskDraft";
import type { Task } from "@/types/board";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    columnId: "c1",
    title: "Title",
    description: textToTaskDescription("Body"),
    position: 1,
    version: 1,
    createdAt: "2026-01-01",
    priority: "none",
    dueDate: null,
    completed: false,
    ...overrides,
  };
}

describe("taskDraft pure logic (mirrors EditTaskDialog behavior)", () => {
  it("creates the opening draft from the saved task snapshot", () => {
    const draft = createTaskDraft(task({ title: "T", dueDate: null }));
    expect(draft).toMatchObject({
      title: "T",
      priority: "none",
      dueDate: "",
      completed: false,
    });
    expect(draft.description).toEqual(textToTaskDescription("Body"));
  });

  it("normalizes legacy text and blank descriptions like the dialog snapshot", () => {
    expect(createTaskDraft(task({ description: "  hello " })).description).toEqual(
      textToTaskDescription("hello"),
    );
    expect(createTaskDraft(task({ description: "   " })).description).toBeUndefined();
    expect(createTaskDraft(task({ description: undefined })).description).toBeUndefined();
  });

  it("detects dirty state across title, description, priority, due date, and completion", () => {
    const base = task();
    expect(isTaskDraftDirty(createTaskDraft(base), base)).toBe(false);
    expect(
      isTaskDraftDirty({ ...createTaskDraft(base), title: "Changed" }, base),
    ).toBe(true);
    expect(
      isTaskDraftDirty({ ...createTaskDraft(base), priority: "high" }, base),
    ).toBe(true);
    expect(
      isTaskDraftDirty({ ...createTaskDraft(base), dueDate: "2026-02-02" }, base),
    ).toBe(true);
    expect(
      isTaskDraftDirty({ ...createTaskDraft(base), completed: true }, base),
    ).toBe(true);
    expect(
      isTaskDraftDirty(
        { ...createTaskDraft(base), description: textToTaskDescription("Other") },
        base,
      ),
    ).toBe(true);
  });

  it("treats empty-string and null due dates as equivalent", () => {
    const base = task({ dueDate: null });
    expect(isTaskDraftDirty({ ...createTaskDraft(base), dueDate: "" }, base)).toBe(false);
  });

  it("rejects a blank title before any save", () => {
    expect(validateTaskDraft({ ...createTaskDraft(task()), title: "   " })).toBe(
      "Task title is required.",
    );
    expect(validateTaskDraft(createTaskDraft(task()))).toBeNull();
  });

  it("builds the update payload with trimmed title and null-cleared due date", () => {
    const payload = buildTaskUpdatePayload({
      ...createTaskDraft(task()),
      title: "  New  ",
      dueDate: "",
      completed: true,
    });
    expect(payload).toMatchObject({
      title: "New",
      priority: "none",
      dueDate: null,
      completed: true,
    });
  });

  it("resolves close behavior: saving wins, dirty flushes, clean closes", () => {
    expect(resolveCloseAction({ hasPendingSave: true, isDirty: false })).toBe("await-save");
    expect(resolveCloseAction({ hasPendingSave: true, isDirty: true })).toBe("await-save");
    expect(resolveCloseAction({ hasPendingSave: false, isDirty: true })).toBe("flush-save");
    expect(resolveCloseAction({ hasPendingSave: false, isDirty: false })).toBe("close");
  });
});
