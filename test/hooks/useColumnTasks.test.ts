import { beforeEach, describe, expect, it, vi } from "vitest";
import { readStaleMoveNotices } from "@/lib/staleMoveNotices";
import { makeTask } from "../fixtures";
import {
  createMockApiAdapter,
  jsonResponse,
  route,
  type MockApiHandle,
  type MockRoute,
} from "../helpers/mockApiModule";

const PENDING_TASK_MOVES_KEY = "kanban-pending-task-moves";

const serverTask = (id: string, columnId: string, position: number) => ({
  id,
  column_id: columnId,
  title: `Task ${id}`,
  position,
  version: 1,
  created_at: "2026-01-01T00:00:00.000Z",
});

/** GET route whose payload is read at request time, so a test can change what "the server returns" between calls. */
function dynamicGet(pathIncludes: string, payload: () => unknown): MockRoute {
  return {
    match: (config) =>
      String(config.method ?? "").toLowerCase() === "get" &&
      String(config.url ?? "").includes(pathIncludes),
    respond: (config) => jsonResponse(config, payload(), 200),
  };
}

function seedPendingMove() {
  sessionStorage.setItem(
    PENDING_TASK_MOVES_KEY,
    JSON.stringify([
      {
        boardId: "b1",
        taskId: "t2",
        sourceColumnId: "c1",
        targetColumnId: "c2",
        position: 0,
        task: makeTask({ id: "t2", columnId: "c1", position: 1, version: 5 }),
      },
    ]),
  );
}

/** Fresh module registry per test so the hydrate-at-import step and the replay guard start clean. */
async function importFresh(handle: MockApiHandle, seed = true) {
  if (seed) seedPendingMove();
  const [hook, { api }] = await Promise.all([
    import("@/hooks/useColumnTasks"),
    import("@/lib/api/axios"),
  ]);
  api.defaults.adapter = handle.adapter;
  return hook;
}

describe("useColumnTasks pending-move reconciliation", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });

  it("overlays the pending move on both lists until the server confirms it", async () => {
    const handle = createMockApiAdapter([
      route("get", "/columns/c1/tasks", [serverTask("t1", "c1", 0)]),
      // The destination is empty: the drop never reached the server (page reloaded mid-flight).
      dynamicGet("/columns/c2/tasks", () => []),
    ]);
    const { columnTasksQueryFn } = await importFresh(handle);

    const source = await columnTasksQueryFn("b1", "c1")();
    expect(source.map((task) => task.id)).toEqual(["t1"]);

    const target = await columnTasksQueryFn("b1", "c2")();
    expect(target.map((task) => task.id)).toEqual(["t2"]);
    // The snapshot's OCC version travels with the overlay so a follow-up mutation sends it.
    expect(target[0].version).toBe(5);
  });

  it("stops overlaying once the destination confirms the move", async () => {
    let targetPayload: unknown[] = [serverTask("t2", "c2", 0)];
    const handle = createMockApiAdapter([
      route("get", "/columns/c1/tasks", [serverTask("t1", "c1", 0)]),
      dynamicGet("/columns/c2/tasks", () => targetPayload),
    ]);
    const { columnTasksQueryFn } = await importFresh(handle);

    // First fetch: the server has the task at the destination, so the pending entry is retired.
    const confirmed = await columnTasksQueryFn("b1", "c2")();
    expect(confirmed.map((task) => task.id)).toEqual(["t2"]);

    // A later refetch reflects server truth only — the overlay no longer applies.
    targetPayload = [];
    const after = await columnTasksQueryFn("b1", "c2")();
    expect(after).toEqual([]);
  });
});

describe("replayStoredTaskMoves", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });

  it("drops a stale replay on 409 and writes a notice for the board", async () => {
    const handle = createMockApiAdapter([
      route("get", "/columns/c1/tasks", [
        serverTask("t2", "c1", 1),
      ]),
      route("get", "/columns/c2/tasks", []),
      route("patch", "/tasks/t2/position", "conflict", 409),
    ]);
    const { replayStoredTaskMoves } = await importFresh(handle);

    await replayStoredTaskMoves("b1");

    // The doomed entry is retired (it would 409 forever) and the user gets a banner message.
    expect(sessionStorage.getItem(PENDING_TASK_MOVES_KEY)).toBeNull();
    expect(readStaleMoveNotices()).toEqual([
      { boardId: "b1", message: expect.any(String) },
    ]);
  });

  it("keeps a queued move when the replay fails for a non-stale reason", async () => {
    const handle = createMockApiAdapter([
      route("get", "/columns/c1/tasks", [
        serverTask("t2", "c1", 1),
      ]),
      route("get", "/columns/c2/tasks", []),
      route("patch", "/tasks/t2/position", "server exploded", 500),
    ]);
    const { replayStoredTaskMoves } = await importFresh(handle);

    await replayStoredTaskMoves("b1");

    // Network/5xx failures are transient: the move stays queued for the next board load, with no notice.
    expect(sessionStorage.getItem(PENDING_TASK_MOVES_KEY)).not.toBeNull();
    expect(readStaleMoveNotices()).toEqual([]);
  });

  it("replays multiple stored moves sequentially", async () => {
    sessionStorage.setItem(
      PENDING_TASK_MOVES_KEY,
      JSON.stringify([
        {
          boardId: "b1",
          taskId: "t2",
          sourceColumnId: "c1",
          targetColumnId: "c2",
          position: 0,
          task: makeTask({ id: "t2", columnId: "c1", version: 5 }),
        },
        {
          boardId: "b1",
          taskId: "t3",
          sourceColumnId: "c1",
          targetColumnId: "c2",
          position: 1,
          task: makeTask({ id: "t3", columnId: "c1", version: 6 }),
        },
      ]),
    );
    const handle = createMockApiAdapter([
      route("get", "/columns/c1/tasks", [
        serverTask("t2", "c1", 0),
        serverTask("t3", "c1", 1),
      ]),
      route("get", "/columns/c2/tasks", []),
      route("patch", "/tasks/t2/position", {
        id: "t2",
        column_id: "c2",
        position: 0,
        version: 6,
      }),
      route("patch", "/tasks/t3/position", {
        id: "t3",
        column_id: "c2",
        position: 1,
        version: 7,
      }),
    ]);
    const { replayStoredTaskMoves } = await importFresh(handle, false);

    await replayStoredTaskMoves("b1");

    expect(
      handle.requests
        .filter((request) => request.method === "patch")
        .map((request) => request.path),
    ).toEqual(["/tasks/t2/position", "/tasks/t3/position"]);
    expect(sessionStorage.getItem(PENDING_TASK_MOVES_KEY)).toBeNull();
  });
});