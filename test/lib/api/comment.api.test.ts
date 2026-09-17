import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/axios";
import { createTaskComment, deleteComment, getTaskComments } from "@/lib/api/comment.api";
import { createMockApiAdapter, noContentRoute, route, type MockApiHandle } from "../../helpers/mockApiModule";

const commentPayload = {
  id: "c1",
  task_id: "t1",
  author_id: "u1",
  author_email: "ada@example.com",
  content: "Nice work",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const mappedComment = {
  id: "c1",
  taskId: "t1",
  authorId: "u1",
  authorEmail: "ada@example.com",
  content: "Nice work",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function mockApi(handle: MockApiHandle) {
  api.defaults.adapter = handle.adapter;
}

describe("comment.api", () => {
  it("getTaskComments maps the comment list", async () => {
    const handle = createMockApiAdapter([route("get", "/tasks/t1/comments", [commentPayload])]);
    mockApi(handle);

    await expect(getTaskComments("t1")).resolves.toEqual([mappedComment]);
    expect(handle.requests[0]).toMatchObject({ method: "get", path: "/tasks/t1/comments" });
  });

  it("createTaskComment posts the content and maps the response", async () => {
    const handle = createMockApiAdapter([route("post", "/tasks/t1/comments", commentPayload)]);
    mockApi(handle);

    await expect(createTaskComment("t1", "Nice work")).resolves.toEqual(mappedComment);
    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/tasks/t1/comments",
      data: { content: "Nice work" },
    });
  });

  it("deleteComment issues a DELETE and resolves", async () => {
    const handle = createMockApiAdapter([noContentRoute("delete", "/comments/c1")]);
    mockApi(handle);

    await expect(deleteComment("c1")).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({ method: "delete", path: "/comments/c1" });
  });
});