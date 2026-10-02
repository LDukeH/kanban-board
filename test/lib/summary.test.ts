import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/axios";
import {
  collectBoardTasks,
  collectWorkspaceBoardTasks,
  computeTaskSummary,
  isOverdue,
  mergeTaskSummaries,
} from "@/lib/summary";
import { makeColumn, makeTask } from "../fixtures";
import {
  createMockApiAdapter,
  route,
  type MockApiHandle,
} from "../helpers/mockApiModule";

const TODAY = "2026-06-15";

function mockApi(handle: MockApiHandle) {
  api.defaults.adapter = handle.adapter;
}

describe("isOverdue", () => {
  it("is false for a completed task even with a past due date", () => {
    expect(
      isOverdue(makeTask({ dueDate: "2026-06-01", completed: true }), TODAY),
    ).toBe(false);
  });

  it("is false when there is no due date", () => {
    expect(isOverdue(makeTask({ dueDate: null }), TODAY)).toBe(false);
  });

  it("is true only when the date is strictly before today", () => {
    expect(isOverdue(makeTask({ dueDate: "2026-06-14" }), TODAY)).toBe(true);
    expect(isOverdue(makeTask({ dueDate: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(makeTask({ dueDate: "2026-06-16" }), TODAY)).toBe(false);
  });
});

describe("computeTaskSummary", () => {
  const columns = [
    makeColumn({ id: "col-1", name: "To Do" }),
    makeColumn({ id: "col-2", name: "Done" }),
    makeColumn({ id: "col-3", name: "Backlog" }),
  ];

  const tasks = [
    // Overdue and unassigned.
    makeTask({ id: "t1", columnId: "col-1", dueDate: "2026-06-01" }),
    // Scheduled in the future.
    makeTask({
      id: "t2",
      columnId: "col-1",
      dueDate: "2026-06-20",
      assignees: [{ user_id: "u1", email: "a@x.com" }],
    }),
    // Completed with no due date, shared by two people.
    makeTask({
      id: "t3",
      columnId: "col-2",
      completed: true,
      assignees: [
        { user_id: "u1", email: "a@x.com" },
        { user_id: "u2", email: "b@x.com" },
      ],
    }),
    // Completed with a past due date (never overdue), in an unknown column.
    makeTask({
      id: "t4",
      columnId: "ghost",
      dueDate: "2026-06-10",
      completed: true,
    }),
  ];

  it("rolls up totals, completion, overdue and unassigned counts", () => {
    const summary = computeTaskSummary(tasks, columns, TODAY);

    expect(summary.total).toBe(4);
    expect(summary.completed).toBe(2);
    expect(summary.overdue).toBe(1);
    // t1 and t4 have no assignees.
    expect(summary.unassigned).toBe(2);
  });

  it("breaks down per column in column order, including empty columns", () => {
    const summary = computeTaskSummary(tasks, columns, TODAY);

    expect(summary.byColumn).toEqual([
      { id: "col-1", label: "To Do", total: 2, completed: 0 },
      { id: "col-2", label: "Done", total: 1, completed: 1 },
      { id: "col-3", label: "Backlog", total: 0, completed: 0 },
    ]);
  });

  it("counts a shared task for each assignee and sorts by workload", () => {
    const summary = computeTaskSummary(tasks, columns, TODAY);

    expect(summary.byAssignee).toEqual([
      { email: "a@x.com", total: 2, completed: 1 },
      // b@x is only on t3, which is completed.
      { email: "b@x.com", total: 1, completed: 1 },
    ]);
  });

  it("returns an all-zero summary for an empty task list", () => {
    const summary = computeTaskSummary([], columns, TODAY);

    expect(summary).toMatchObject({
      total: 0,
      completed: 0,
      overdue: 0,
      unassigned: 0,
      byAssignee: [],
    });
    expect(summary.byColumn).toHaveLength(3);
  });
});

describe("mergeTaskSummaries", () => {
  it("sums totals, merges assignees, and drops the per-column breakdown", () => {
    const first = computeTaskSummary(
      [
        makeTask({ id: "t1", dueDate: "2026-06-01" }),
        makeTask({
          id: "t2",
          completed: true,
          assignees: [{ user_id: "u1", email: "a@x.com" }],
        }),
      ],
      [makeColumn({ id: "col-1" })],
      TODAY,
    );
    const second = computeTaskSummary(
      [
        makeTask({
          id: "t3",
          assignees: [{ user_id: "u1", email: "a@x.com" }],
        }),
        makeTask({ id: "t4" }),
        makeTask({ id: "t5" }),
      ],
      [makeColumn({ id: "col-2" })],
      TODAY,
    );

    const merged = mergeTaskSummaries([first, second]);

    expect(merged.total).toBe(5);
    expect(merged.completed).toBe(1);
    expect(merged.overdue).toBe(1);
    // t1 in the first group plus t4 and t5 in the second.
    expect(merged.unassigned).toBe(3);
    // Column names are board-scoped, so a merged list would be misleading.
    expect(merged.byColumn).toEqual([]);
    expect(merged.byAssignee).toEqual([
      { email: "a@x.com", total: 2, completed: 1 },
    ]);
  });

  it("returns zeroes for no summaries", () => {
    expect(mergeTaskSummaries([])).toEqual({
      total: 0,
      completed: 0,
      overdue: 0,
      unassigned: 0,
      byColumn: [],
      byAssignee: [],
    });
  });
});

describe("collectors", () => {
  const columnPayload = (id: string, boardId: string) => ({
    id,
    board_id: boardId,
    name: "To Do",
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });

  const taskPayload = (id: string, columnId: string) => ({
    id,
    column_id: columnId,
    title: id,
    position: 0,
    priority: "low",
    due_date: "2026-06-01",
    completed: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });

  it("collectBoardTasks fetches the column list then its tasks", async () => {
    const handle = createMockApiAdapter([
      route("get", "/boards/b1/columns", [columnPayload("c1", "b1")]),
      route("get", "/columns/c1/tasks", [taskPayload("t1", "c1")]),
    ]);
    mockApi(handle);

    const { columns, tasks } = await collectBoardTasks("b1");

    expect(handle.requests.map((r) => r.path)).toEqual([
      "/boards/b1/columns",
      "/columns/c1/tasks",
    ]);
    expect(columns.map((c) => c.id)).toEqual(["c1"]);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      priority: "low",
      dueDate: "2026-06-01",
      completed: false,
    });
  });

  it("collectWorkspaceBoardTasks walks boards, columns and tasks in order", async () => {
    const boardPayload = (id: string) => ({
      id,
      workspace_id: "ws1",
      name: id.toUpperCase(),
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const handle = createMockApiAdapter([
      route("get", "/workspaces/ws1/boards", [boardPayload("b1"), boardPayload("b2")]),
      route("get", "/boards/b1/columns", [columnPayload("c1", "b1")]),
      route("get", "/boards/b2/columns", [columnPayload("c2", "b2")]),
      route("get", "/columns/c1/tasks", [taskPayload("t1", "c1")]),
      route("get", "/columns/c2/tasks", [taskPayload("t2", "c2")]),
    ]);
    mockApi(handle);

    const results = await collectWorkspaceBoardTasks("ws1");

    expect(handle.requests.map((r) => r.path)).toEqual([
      "/workspaces/ws1/boards",
      "/boards/b1/columns",
      "/columns/c1/tasks",
      "/boards/b2/columns",
      "/columns/c2/tasks",
    ]);
    expect(results.map((entry) => entry.board.id)).toEqual(["b1", "b2"]);
    expect(results.map((entry) => entry.tasks.length)).toEqual([1, 1]);
  });
});
