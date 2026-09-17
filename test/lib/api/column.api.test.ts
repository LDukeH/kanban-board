import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/axios";
import {
  createColumn,
  deleteColumn,
  getBoardColumns,
  updateColumn,
  updateColumnPosition,
} from "@/lib/api/column.api";
import { createMockApiAdapter, noContentRoute, route, type MockApiHandle } from "../../helpers/mockApiModule";

const columnPayload = {
  id: "c1",
  board_id: "b1",
  name: "To Do",
  position: 2,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const mappedColumn = {
  id: "c1",
  boardId: "b1",
  name: "To Do",
  position: 2,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function mockApi(handle: MockApiHandle) {
  api.defaults.adapter = handle.adapter;
}

describe("column.api", () => {
  it("getBoardColumns maps the column list", async () => {
    const handle = createMockApiAdapter([route("get", "/boards/b1/columns", [columnPayload])]);
    mockApi(handle);

    await expect(getBoardColumns("b1")).resolves.toEqual([mappedColumn]);
    expect(handle.requests[0]).toMatchObject({ method: "get", path: "/boards/b1/columns" });
  });

  it("createColumn posts the name and maps the response", async () => {
    const handle = createMockApiAdapter([route("post", "/boards/b1/columns", columnPayload)]);
    mockApi(handle);

    await expect(createColumn("b1", { name: "To Do" })).resolves.toEqual(mappedColumn);
    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/boards/b1/columns",
      data: { name: "To Do" },
    });
  });

  it("updateColumn patches the name and maps the response", async () => {
    const handle = createMockApiAdapter([route("patch", "/columns/c1", columnPayload)]);
    mockApi(handle);

    await expect(updateColumn("c1", { name: "Done" })).resolves.toEqual(mappedColumn);
    expect(handle.requests[0]).toMatchObject({
      method: "patch",
      path: "/columns/c1",
      data: { name: "Done" },
    });
  });

  it("updateColumnPosition sends the position to the dedicated endpoint", async () => {
    const handle = createMockApiAdapter([route("patch", "/c1/position", columnPayload)]);
    mockApi(handle);

    await expect(updateColumnPosition("c1", 3)).resolves.toEqual(mappedColumn);
    expect(handle.requests[0]).toMatchObject({
      method: "patch",
      path: "/columns/c1/position",
      data: { position: 3 },
    });
  });

  it("deleteColumn issues a DELETE and resolves", async () => {
    const handle = createMockApiAdapter([noContentRoute("delete", "/columns/c1")]);
    mockApi(handle);

    await expect(deleteColumn("c1")).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({ method: "delete", path: "/columns/c1" });
  });
});