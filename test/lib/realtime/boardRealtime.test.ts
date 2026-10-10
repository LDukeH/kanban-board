import { afterEach, describe, expect, it, vi } from "vitest";
import {
  boardEventInvalidation,
  createBoardEventCoalescer,
} from "@/lib/realtime/useBoardRealtime";
import type { BoardEventEnvelope } from "@/lib/realtime/boardEvents";

const BOARD_ID = "board-1";
const OTHER_BOARD_ID = "board-2";

function makeEvent(
  overrides: Partial<BoardEventEnvelope> & { type: BoardEventEnvelope["type"] },
): BoardEventEnvelope {
  const base = {
    id: "evt-1",
    board_id: BOARD_ID,
    entity_id: "entity-1",
    column_id: "col-1",
    version: 1,
    actor_id: "user-1",
    occurred_at: "2026-01-01T00:00:00.000Z",
  };
  if (overrides.type === "task_moved") {
    return { ...base, source_column_id: "col-0", ...overrides } as BoardEventEnvelope;
  }
  return { ...base, ...overrides } as BoardEventEnvelope;
}

function matches(
  boardId: string,
  event: BoardEventEnvelope,
  queryKey: readonly unknown[],
): boolean {
  const filters = boardEventInvalidation(boardId, event);
  if (!filters?.predicate) return false;
  const predicate = filters.predicate;
  return predicate({ queryKey } as Parameters<typeof predicate>[0]);
}

const COLUMNS_KEY = ["boards", BOARD_ID, "columns"];
const TASKS_KEY = ["boards", BOARD_ID, "columns", "col-1", "tasks"];
const OTHER_TASKS_KEY = ["boards", BOARD_ID, "columns", "col-9", "tasks"];
const OTHER_BOARD_KEY = ["boards", OTHER_BOARD_ID, "columns"];
const LABELS_KEY = ["boards", BOARD_ID, "labels"];

describe("boardEventInvalidation", () => {
  it.each([
    "task_created",
    "task_updated",
    "task_deleted",
    "task_moved",
  ] as const)("task event %s matches columns and every task list", (type) => {
    const event = makeEvent({ type });
    expect(matches(BOARD_ID, event, COLUMNS_KEY)).toBe(true);
    expect(matches(BOARD_ID, event, TASKS_KEY)).toBe(true);
    expect(matches(BOARD_ID, event, OTHER_TASKS_KEY)).toBe(true);
  });

  it.each([
    "column_created",
    "column_updated",
    "column_moved",
  ] as const)("column event %s matches columns only", (type) => {
    const event = makeEvent({ type });
    expect(matches(BOARD_ID, event, COLUMNS_KEY)).toBe(true);
    expect(matches(BOARD_ID, event, TASKS_KEY)).toBe(false);
  });

  it("column_deleted matches columns and every task list", () => {
    const event = makeEvent({ type: "column_deleted" });
    expect(matches(BOARD_ID, event, COLUMNS_KEY)).toBe(true);
    expect(matches(BOARD_ID, event, TASKS_KEY)).toBe(true);
    expect(matches(BOARD_ID, event, OTHER_TASKS_KEY)).toBe(true);
  });

  it("never matches another board or unrelated queries", () => {
    const event = makeEvent({ type: "task_moved" });
    expect(matches(BOARD_ID, event, OTHER_BOARD_KEY)).toBe(false);
    expect(matches(BOARD_ID, event, LABELS_KEY)).toBe(false);
  });
});

describe("createBoardEventCoalescer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    vi.useFakeTimers();
    const calls: Array<{ predicate: (q: { queryKey: readonly unknown[] }) => boolean }> = [];
    const queryClient = {
      invalidateQueries: (filters: {
        predicate: (q: { queryKey: readonly unknown[] }) => boolean;
      }) => {
        calls.push(filters);
        return Promise.resolve();
      },
    };
    return { calls, queryClient };
  }

  it("coalesces a reorder burst into a single invalidation", () => {
    const { calls, queryClient } = setup();
    const coalescer = createBoardEventCoalescer(queryClient, BOARD_ID, 300);
    coalescer.push(makeEvent({ type: "task_moved", id: "e1" }));
    coalescer.push(makeEvent({ type: "task_moved", id: "e2" }));
    coalescer.push(makeEvent({ type: "task_moved", id: "e3" }));
    expect(calls).toHaveLength(0);
    vi.advanceTimersByTime(300);
    expect(calls).toHaveLength(1);
    expect(calls[0].predicate({ queryKey: TASKS_KEY })).toBe(true);
    expect(calls[0].predicate({ queryKey: OTHER_BOARD_KEY })).toBe(false);
    coalescer.dispose();
  });

  it("column_deleted invalidates columns and tasks in one pass", () => {
    const { calls, queryClient } = setup();
    const coalescer = createBoardEventCoalescer(queryClient, BOARD_ID, 300);
    coalescer.push(makeEvent({ type: "task_updated", id: "e1" }));
    coalescer.push(makeEvent({ type: "column_deleted", id: "e2" }));
    vi.advanceTimersByTime(300);
    expect(calls).toHaveLength(1);
    expect(calls[0].predicate({ queryKey: COLUMNS_KEY })).toBe(true);
    expect(calls[0].predicate({ queryKey: TASKS_KEY })).toBe(true);
    coalescer.dispose();
  });

  it("ignores events from other boards and stops after dispose", () => {
    const { calls, queryClient } = setup();
    const coalescer = createBoardEventCoalescer(queryClient, BOARD_ID, 300);
    coalescer.push(makeEvent({ type: "task_moved", board_id: OTHER_BOARD_ID }));
    vi.advanceTimersByTime(300);
    expect(calls).toHaveLength(0);
    coalescer.push(makeEvent({ type: "task_moved", id: "e1" }));
    coalescer.dispose();
    vi.advanceTimersByTime(1000);
    expect(calls).toHaveLength(0);
  });
});
