import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/axios";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notification.api";
import { createMockApiAdapter, noContentRoute, route, type MockApiHandle } from "../../helpers/mockApiModule";

function mockApi(handle: MockApiHandle) {
  api.defaults.adapter = handle.adapter;
}

describe("notification.api", () => {
  it("mapNotifications maps task_assigned payloads to camelCase", async () => {
    const payload = {
      id: "n1",
      user_id: "u1",
      type: "task_assigned",
      payload: { task_id: "t1", task_title: "Ship it", actor_email: "ada@example.com" },
      read_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const handle = createMockApiAdapter([route("get", "/notifications", [payload])]);
    mockApi(handle);

    const [notification] = await getNotifications();

    expect(notification).toMatchObject({
      id: "n1",
      type: "task_assigned",
      readAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(notification.payload).toEqual({
      taskId: "t1",
      taskTitle: "Ship it",
      actorEmail: "ada@example.com",
    });
  });

  it("maps workspace_invited payloads to camelCase", async () => {
    const payload = {
      id: "n2",
      user_id: "u1",
      type: "workspace_invited",
      payload: {
        invitation_id: "inv1",
        workspace_id: "ws1",
        workspace_name: "Team",
        actor_email: "ada@example.com",
      },
      read_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const handle = createMockApiAdapter([route("get", "/notifications", [payload])]);
    mockApi(handle);

    const [notification] = await getNotifications();

    expect(notification.type).toBe("workspace_invited");
    expect(notification.payload).toEqual({
      invitationId: "inv1",
      workspaceId: "ws1",
      workspaceName: "Team",
      actorEmail: "ada@example.com",
    });
  });

  it("maps a workspace_invited payload without invitation_id to an empty id", async () => {
    // A backend that predates the field must not break the app: the empty id is
    // the contract that tells consumers to fall back to the inline notice
    // instead of firing an accept/decline request (docs/api/invitations.md).
    const payload = {
      id: "n4",
      user_id: "u1",
      type: "workspace_invited",
      payload: {
        workspace_id: "ws1",
        workspace_name: "Team",
        actor_email: "ada@example.com",
      },
      read_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const handle = createMockApiAdapter([route("get", "/notifications", [payload])]);
    mockApi(handle);

    const [notification] = await getNotifications();

    expect(notification.type).toBe("workspace_invited");
    expect(notification.payload).toEqual({
      invitationId: "",
      workspaceId: "ws1",
      workspaceName: "Team",
      actorEmail: "ada@example.com",
    });
  });

  it("coerces unknown types and missing payload fields to safe defaults", async () => {
    const payload = {
      id: "n3",
      type: "something_else",
      payload: { task_id: "t9" },
      read_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const handle = createMockApiAdapter([route("get", "/notifications", [payload])]);
    mockApi(handle);

    const [notification] = await getNotifications();

    // Unknown types fall through to the workspace_invited mapping branch.
    expect(notification.type).toBe("workspace_invited");
    expect(notification.payload).toEqual({
      invitationId: "",
      workspaceId: "",
      workspaceName: "",
      actorEmail: "",
    });
  });

  it("sends limit and unread_only params", async () => {
    const handle = createMockApiAdapter([route("get", "/notifications", [])]);
    mockApi(handle);

    await getNotifications({ limit: 20, unreadOnly: false });

    expect(handle.requests[0]).toMatchObject({
      method: "get",
      path: "/notifications",
      params: { limit: 20, unread_only: false },
    });
  });

  it("getUnreadNotificationCount extracts the count", async () => {
    const handle = createMockApiAdapter([route("get", "/unread-count", { unread_count: 5 })]);
    mockApi(handle);

    await expect(getUnreadNotificationCount()).resolves.toBe(5);
  });

  it("markNotificationRead posts to the read endpoint", async () => {
    const handle = createMockApiAdapter([noContentRoute("post", "/notifications/n1/read")]);
    mockApi(handle);

    await expect(markNotificationRead("n1")).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({ method: "post", path: "/notifications/n1/read" });
  });

  it("markAllNotificationsRead posts to the read-all endpoint", async () => {
    const handle = createMockApiAdapter([noContentRoute("post", "/notifications/read-all")]);
    mockApi(handle);

    await expect(markAllNotificationsRead()).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({ method: "post", path: "/notifications/read-all" });
  });
});