import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/axios";
import {
  changeMemberRole,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  getWorkspaceMembers,
  getWorkspaces,
  leaveWorkspace,
  removeMember,
  transferWorkspaceOwnership,
  updateWorkspace,
} from "@/lib/api/workspace.api";
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

const workspacePayload = {
  id: "ws1",
  name: "Team",
  description: "The A team",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const mappedWorkspace = {
  id: "ws1",
  name: "Team",
  description: "The A team",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const memberPayload = {
  id: "m1",
  workspace_id: "ws1",
  user_id: "u1",
  role: "admin" as const,
  email: "ada@example.com",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const mappedMember = {
  id: "m1",
  workspaceId: "ws1",
  userId: "u1",
  role: "admin",
  email: "ada@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("workspace.api CRUD", () => {
  it("getWorkspaces maps the workspace list", async () => {
    const handle = createMockApiAdapter([route("get", "/workspaces", [workspacePayload])]);
    mockApi(handle);

    await expect(getWorkspaces()).resolves.toEqual([mappedWorkspace]);
    expect(handle.requests[0]).toMatchObject({ method: "get", path: "/workspaces" });
  });

  it("createWorkspace posts and maps the response", async () => {
    const handle = createMockApiAdapter([route("post", "/workspaces", workspacePayload)]);
    mockApi(handle);

    await expect(createWorkspace({ name: "Team", description: "The A team" })).resolves.toEqual(
      mappedWorkspace,
    );
    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/workspaces",
      data: { name: "Team", description: "The A team" },
    });
  });

  it("updateWorkspace patches and maps the response", async () => {
    const handle = createMockApiAdapter([route("patch", "/workspaces/ws1", workspacePayload)]);
    mockApi(handle);

    await expect(updateWorkspace("ws1", { name: "Team v2" })).resolves.toEqual(mappedWorkspace);
  });

  it("getWorkspace reads a single workspace and maps the description", async () => {
    const handle = createMockApiAdapter([
      suffixRoute("get", "/workspaces/ws1", workspacePayload),
    ]);
    mockApi(handle);

    await expect(getWorkspace("ws1")).resolves.toEqual(mappedWorkspace);
    expect(handle.requests[0]).toMatchObject({ method: "get", path: "/workspaces/ws1" });
  });

  it("normalizes a missing description to an empty string", async () => {
    const payloadWithoutDescription = {
      id: workspacePayload.id,
      name: workspacePayload.name,
      created_at: workspacePayload.created_at,
      updated_at: workspacePayload.updated_at,
    };
    const handle = createMockApiAdapter([
      suffixRoute("get", "/workspaces/ws1", payloadWithoutDescription),
    ]);
    mockApi(handle);

    const result = await getWorkspace("ws1");
    expect(result.description).toBe("");
  });

  it("normalizes a null description to an empty string", async () => {
    const handle = createMockApiAdapter([
      suffixRoute("get", "/workspaces/ws1", { ...workspacePayload, description: null }),
    ]);
    mockApi(handle);

    await expect(getWorkspace("ws1")).resolves.toEqual({
      ...mappedWorkspace,
      description: "",
    });
  });

  it("sends an empty description to clear the stored value", async () => {
    const handle = createMockApiAdapter([
      suffixRoute("patch", "/workspaces/ws1", { ...workspacePayload, description: "" }),
    ]);
    mockApi(handle);

    await updateWorkspace("ws1", { name: "Team", description: "" });

    // The key must be present with an empty value: omitting it would leave the
    // stored description untouched on the backend.
    expect(handle.requests[0]).toMatchObject({
      method: "patch",
      path: "/workspaces/ws1",
      data: { name: "Team", description: "" },
    });
    expect(handle.requests[0].data).toHaveProperty("description", "");
  });

  it("omits the description key entirely when it is not provided", async () => {
    const handle = createMockApiAdapter([suffixRoute("patch", "/workspaces/ws1", workspacePayload)]);
    mockApi(handle);

    await updateWorkspace("ws1", { name: "Team" });

    expect(handle.requests[0]).toMatchObject({ data: { name: "Team" } });
    expect(handle.requests[0].data).not.toHaveProperty("description");
  });

  it("always resends the name so a description-only edit cannot 400", async () => {
    const handle = createMockApiAdapter([suffixRoute("patch", "/workspaces/ws1", workspacePayload)]);
    mockApi(handle);

    await updateWorkspace("ws1", { name: "Team", description: "Platform roadmap" });

    expect(handle.requests[0]).toMatchObject({
      data: { name: "Team", description: "Platform roadmap" },
    });
  });

  it("deleteWorkspace issues a DELETE and resolves", async () => {
    const handle = createMockApiAdapter([noContentRoute("delete", "/workspaces/ws1")]);
    mockApi(handle);

    await expect(deleteWorkspace("ws1")).resolves.toBeUndefined();
  });
});

describe("workspace.api members", () => {
  it("getWorkspaceMembers maps the member list", async () => {
    const handle = createMockApiAdapter([route("get", "/workspaces/ws1/members", [memberPayload])]);
    mockApi(handle);

    await expect(getWorkspaceMembers("ws1")).resolves.toEqual([mappedMember]);
  });

  it("changeMemberRole patches the role and maps the response", async () => {
    const handle = createMockApiAdapter([route("patch", "/workspaces/ws1/members/m1", memberPayload)]);
    mockApi(handle);

    await expect(changeMemberRole("ws1", "m1", "admin")).resolves.toEqual(mappedMember);
    expect(handle.requests[0]).toMatchObject({
      method: "patch",
      path: "/workspaces/ws1/members/m1",
      data: { role: "admin" },
    });
  });

  it("removeMember issues a DELETE and resolves", async () => {
    const handle = createMockApiAdapter([noContentRoute("delete", "/workspaces/ws1/members/m1")]);
    mockApi(handle);

    await expect(removeMember("ws1", "m1")).resolves.toBeUndefined();
  });

  it("leaveWorkspace deletes the memberships endpoint", async () => {
    const handle = createMockApiAdapter([noContentRoute("delete", "/workspaces/ws1/memberships")]);
    mockApi(handle);

    await expect(leaveWorkspace("ws1")).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({ method: "delete", path: "/workspaces/ws1/memberships" });
  });
});

describe("transferWorkspaceOwnership", () => {
  it("accepts a 204 No Content success", async () => {
    const handle = createMockApiAdapter([noContentRoute("post", "/workspaces/ws1/transfer-ownership")]);
    mockApi(handle);

    await expect(transferWorkspaceOwnership("ws1", "u2")).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/workspaces/ws1/transfer-ownership",
      data: { new_owner_id: "u2" },
    });
  });

  it("rejects non-204 responses", async () => {
    const handle = createMockApiAdapter([route("post", "/workspaces/ws1/transfer-ownership", {})]);
    mockApi(handle);

    await expect(transferWorkspaceOwnership("ws1", "u2")).rejects.toThrow("Unexpected status 200");
  });
});