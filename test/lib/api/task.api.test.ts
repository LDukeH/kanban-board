import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/axios";
import type { TaskDescription } from "@/lib/description";
import {
  assignUserToTask,
  createTask,
  deleteTask,
  findBoardIdForTask,
  getColumnTasks,
  getTaskAssignees,
  unassignUserFromTask,
  updateTask,
  updateTaskPosition,
} from "@/lib/api/task.api";
import {
  createMockApiAdapter,
  noContentRoute,
  route,
  suffixRoute,
  type MockApiHandle,
} from "../../helpers/mockApiModule";

function mockApi(handle: MockApiHandle) {
  api.defaults.adapter = handle.adapter;
}

const taskDoc: TaskDescription = { type: "doc", content: [{ type: "text", text: "hello" }] };

const tasksPayload = [
  {
    id: "t1",
    column_id: "c1",
    title: "Task one",
    description: taskDoc,
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    labels: [
      {
        id: "l1",
        board_id: "b1",
        name: "Bug",
        color: "",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ],
    assignees: [{ user_id: "u1", email: "a@b.com" }],
  },
  {
    id: "t2",
    column_id: "c1",
    title: "Legacy",
    description: "plain text",
    position: 1,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "t3",
    column_id: "c1",
    title: "Null desc",
    description: null,
    position: 2,
    created_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "t4",
    column_id: "c1",
    title: "Bad desc",
    description: { type: "slide" },
    position: 3,
    created_at: "2026-01-01T00:00:00.000Z",
  },
];

describe("task.api mapping", () => {
  it("getColumnTasks maps labels, assignees, and normalizes descriptions", async () => {
    const handle = createMockApiAdapter([route("get", "/columns/c1/tasks", tasksPayload)]);
    mockApi(handle);

    const tasks = await getColumnTasks("c1");

    expect(handle.requests[0]).toMatchObject({ method: "get", path: "/columns/c1/tasks" });
    expect(tasks).toHaveLength(4);
    expect(tasks[0].id).toBe("t1");
    expect(tasks[0].description).toEqual(taskDoc);
    expect(tasks[0].labels).toEqual([
      {
        id: "l1",
        boardId: "b1",
        name: "Bug",
        color: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(tasks[0].assignees).toEqual([{ user_id: "u1", email: "a@b.com" }]);
    expect(tasks[1].description).toBe("plain text");
    expect(tasks[2].description).toBeUndefined();
    expect(tasks[3].description).toBeUndefined();
  });

  it("maps priority, due_date and completed from the task response", async () => {
    const handle = createMockApiAdapter([
      route("get", "/columns/c1/tasks", [
        {
          ...tasksPayload[0],
          priority: "high",
          due_date: "2026-10-02",
          completed: true,
        },
      ]),
    ]);
    mockApi(handle);

    const [task] = await getColumnTasks("c1");

    expect(task).toMatchObject({
      priority: "high",
      dueDate: "2026-10-02",
      completed: true,
    });
  });

  it("falls back to the neutral metadata when the keys are absent", async () => {
    const handle = createMockApiAdapter([
      route("get", "/columns/c1/tasks", [tasksPayload[1]]),
    ]);
    mockApi(handle);

    const [task] = await getColumnTasks("c1");

    expect(task).toMatchObject({
      priority: "none",
      dueDate: null,
      completed: false,
    });
  });

  it("createTask posts title/description and maps the response", async () => {
    const handle = createMockApiAdapter([route("post", "/columns/c1/tasks", tasksPayload[0])]);
    mockApi(handle);

    const created = await createTask("c1", { title: "Task one", description: taskDoc });

    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/columns/c1/tasks",
      data: { title: "Task one", description: taskDoc },
    });
    expect(created.id).toBe("t1");
  });

  it("createTask posts metadata as snake_case and omits absent keys", async () => {
    const handle = createMockApiAdapter([
      route("post", "/columns/c1/tasks", tasksPayload[0]),
    ]);
    mockApi(handle);

    await createTask("c1", {
      title: "Task one",
      priority: "high",
      dueDate: "2026-10-02",
      completed: true,
    });

    expect(handle.requests[0].data).toEqual({
      title: "Task one",
      priority: "high",
      // dueDate is mapped to the snake_case field the backend reads.
      due_date: "2026-10-02",
      completed: true,
    });
  });

  it("createTask sends an explicit null due_date when no date is chosen", async () => {
    const handle = createMockApiAdapter([
      route("post", "/columns/c1/tasks", tasksPayload[0]),
    ]);
    mockApi(handle);

    await createTask("c1", { title: "No date", dueDate: null });

    expect(handle.requests[0].data).toEqual({ title: "No date", due_date: null });
  });
});

describe("task.api mutations", () => {
  it("updateTask patches only the provided fields", async () => {
    const handle = createMockApiAdapter([noContentRoute("patch", "/tasks/t1")]);
    mockApi(handle);

    await expect(updateTask("t1", { title: "Renamed", version: 1 })).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({
      method: "patch",
      path: "/tasks/t1",
      data: { title: "Renamed", version: 1 },
    });
  });

  it("updateTask maps metadata to snake_case and keeps an explicit null due_date", async () => {
    const handle = createMockApiAdapter([noContentRoute("patch", "/tasks/t1")]);
    mockApi(handle);

    await updateTask("t1", {
      priority: "low",
      // null is the documented "clear the date" signal, so it must survive
      // serialization rather than being dropped like an absent key.
      dueDate: null,
      completed: false,
      version: 1,
    });

    expect(handle.requests[0].data).toEqual({
      priority: "low",
      due_date: null,
      completed: false,
      version: 1,
    });
  });

  it("updateTask drops keys that were not provided", async () => {
    const handle = createMockApiAdapter([noContentRoute("patch", "/tasks/t1")]);
    mockApi(handle);

    await updateTask("t1", { priority: "high", version: 1 });

    // No due_date key at all: the stored date must be left untouched.
    expect(handle.requests[0].data).toEqual({ priority: "high", version: 1 });
  });

  it("updateTaskPosition sends snake_case column_id", async () => {
    const handle = createMockApiAdapter([noContentRoute("patch", "/tasks/t1/position")]);
    mockApi(handle);

    await expect(updateTaskPosition("t1", { columnId: "c2", position: 2, version: 1 })).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({
      method: "patch",
      path: "/tasks/t1/position",
      data: { column_id: "c2", position: 2, version: 1 },
    });
  });

  it("deleteTask issues a DELETE and resolves", async () => {
    const handle = createMockApiAdapter([noContentRoute("delete", "/tasks/t1")]);
    mockApi(handle);

    await expect(deleteTask("t1", 1)).resolves.toBeUndefined();
  });

  it("getTaskAssignees returns the raw assignee list", async () => {
    const handle = createMockApiAdapter([
      route("get", "/tasks/t1/users", [{ user_id: "u1", email: "a@b.com" }]),
    ]);
    mockApi(handle);

    await expect(getTaskAssignees("t1")).resolves.toEqual([{ user_id: "u1", email: "a@b.com" }]);
  });

  it("assignUserToTask posts the user_id", async () => {
    const handle = createMockApiAdapter([noContentRoute("post", "/tasks/t1/users")]);
    mockApi(handle);

    await expect(assignUserToTask("t1", "u1")).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/tasks/t1/users",
      data: { user_id: "u1" },
    });
  });

  it("unassignUserFromTask sends the user_id in the DELETE body", async () => {
    const handle = createMockApiAdapter([noContentRoute("delete", "/tasks/t1/users")]);
    mockApi(handle);

    await expect(unassignUserFromTask("t1", "u1")).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({
      method: "delete",
      path: "/tasks/t1/users",
      data: { user_id: "u1" },
    });
  });
});
describe("findBoardIdForTask", () => {
  const boardPayload = {
    id: "b1",
    workspace_id: "ws1",
    name: "Roadmap",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const workspacePayload = {
    id: "ws1",
    name: "Team",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const columnPayload = {
    id: "c1",
    board_id: "b1",
    name: "To Do",
    position: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const emptyTasks = [{ id: "other-task", column_id: "c1", title: "x", position: 0, created_at: "2026-01-01T00:00:00.000Z" }];

  it("resolves the owning board through the endpoint cascade and caches it", async () => {
    const handle = createMockApiAdapter([
      suffixRoute("get", "/columns/c1/tasks", [
        { id: "found-task", column_id: "c1", title: "x", position: 0, created_at: "2026-01-01T00:00:00.000Z" },
      ]),
      suffixRoute("get", "/boards/b1/columns", [columnPayload]),
      suffixRoute("get", "/workspaces/ws1/boards", [boardPayload]),
      suffixRoute("get", "/workspaces", [workspacePayload]),
    ]);
    mockApi(handle);

    await expect(findBoardIdForTask("found-task")).resolves.toBe("b1");
    const requestsAfterFirst = handle.requests.length;
    // Second call resolves from the session cache without new requests.
    await expect(findBoardIdForTask("found-task")).resolves.toBe("b1");
    expect(handle.requests.length).toBe(requestsAfterFirst);
  });

  it("returns undefined and caches the miss when the task is nowhere", async () => {
    const handle = createMockApiAdapter([
      suffixRoute("get", "/columns/c1/tasks", emptyTasks),
      suffixRoute("get", "/boards/b1/columns", [columnPayload]),
      suffixRoute("get", "/workspaces/ws1/boards", [boardPayload]),
      suffixRoute("get", "/workspaces", [workspacePayload]),
    ]);
    mockApi(handle);

    await expect(findBoardIdForTask("missing-task")).resolves.toBeUndefined();
    const requestsAfterFirst = handle.requests.length;
    await expect(findBoardIdForTask("missing-task")).resolves.toBeUndefined();
    expect(handle.requests.length).toBe(requestsAfterFirst);
  });
});