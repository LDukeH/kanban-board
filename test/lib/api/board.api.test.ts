import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/axios";
import {
  createBoard,
  deleteBoard,
  getBoard,
  getBoards,
  updateBoard,
} from "@/lib/api/board.api";
import { createMockApiAdapter, noContentRoute, route, type MockApiHandle } from "../../helpers/mockApiModule";

const boardPayload = {
  id: "b1",
  workspace_id: "ws1",
  name: "Roadmap",
  description: "Top-level plan",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

const mappedBoard = {
  id: "b1",
  workspaceId: "ws1",
  name: "Roadmap",
  description: "Top-level plan",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

function mockApi(handle: MockApiHandle) {
  api.defaults.adapter = handle.adapter;
}

describe("board.api", () => {
  it("getBoards returns the mapped board list for the workspace", async () => {
    const handle = createMockApiAdapter([route("get", "/workspaces/ws1/boards", [boardPayload])]);
    mockApi(handle);

    const boards = await getBoards("ws1");

    expect(handle.requests[0]).toMatchObject({ method: "get", path: "/workspaces/ws1/boards" });
    expect(boards).toEqual([mappedBoard]);
  });

  it("getBoard maps a single board", async () => {
    const handle = createMockApiAdapter([route("get", "/boards/b1", boardPayload)]);
    mockApi(handle);

    await expect(getBoard("b1")).resolves.toEqual(mappedBoard);
    expect(handle.requests[0]).toMatchObject({ method: "get", path: "/boards/b1" });
  });

  it("createBoard posts the payload and returns the mapped board", async () => {
    const handle = createMockApiAdapter([route("post", "/workspaces/ws1/boards", boardPayload)]);
    mockApi(handle);

    const board = await createBoard("ws1", { name: "Roadmap", description: "Top-level plan" });

    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/workspaces/ws1/boards",
      data: { name: "Roadmap", description: "Top-level plan" },
    });
    expect(board).toEqual(mappedBoard);
  });

  it("updateBoard patches and returns the mapped board", async () => {
    const handle = createMockApiAdapter([route("patch", "/boards/b1", boardPayload)]);
    mockApi(handle);

    await expect(updateBoard("b1", { name: "Roadmap v2" })).resolves.toEqual(mappedBoard);
    expect(handle.requests[0]).toMatchObject({
      method: "patch",
      path: "/boards/b1",
      data: { name: "Roadmap v2" },
    });
  });

  it("deleteBoard issues a DELETE and resolves", async () => {
    const handle = createMockApiAdapter([noContentRoute("delete", "/boards/b1")]);
    mockApi(handle);

    await expect(deleteBoard("b1")).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({ method: "delete", path: "/boards/b1" });
  });
});