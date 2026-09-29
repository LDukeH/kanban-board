import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/axios";
import {
  acceptInvitation,
  cancelInvitation,
  createInvitation,
  declineInvitation,
  getWorkspaceInvitations,
} from "@/lib/api/invitation.api";
import {
  createMockApiAdapter,
  route,
  suffixRoute,
  type MockApiHandle,
} from "../../helpers/mockApiModule";

function mockApi(handle: MockApiHandle) {
  api.defaults.adapter = handle.adapter;
}

// Shape observed on the live backend: the documented conceptual fields (§3.4)
// plus `invitee_email`.
const invitationPayload = {
  id: "inv1",
  workspace_id: "ws1",
  invitee_user_id: "u1",
  invited_by_user_id: "u2",
  status: "pending" as const,
  invitee_email: "ada@example.com",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  expires_at: "2026-01-08T00:00:00.000Z",
};

const mappedInvitation = {
  id: "inv1",
  workspaceId: "ws1",
  inviteeUserId: "u1",
  invitedByUserId: "u2",
  status: "pending",
  inviteeEmail: "ada@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2026-01-08T00:00:00.000Z",
};

describe("invitation.api", () => {
  it("createInvitation posts the invitee user id (never a role) and maps the response", async () => {
    const handle = createMockApiAdapter([
      route("post", "/workspaces/ws1/invitations", invitationPayload, 201),
    ]);
    mockApi(handle);

    await expect(createInvitation("ws1", { userId: "u1" })).resolves.toEqual(
      mappedInvitation,
    );
    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/workspaces/ws1/invitations",
      data: { user_id: "u1" },
    });
    expect(handle.requests[0].data).not.toHaveProperty("role");
    expect(handle.requests[0].data).not.toHaveProperty("email");
  });

  it("getWorkspaceInvitations maps every status in the list", async () => {
    const handle = createMockApiAdapter([
      route("get", "/workspaces/ws1/invitations", [
        invitationPayload,
        { ...invitationPayload, id: "inv2", status: "accepted" },
        { ...invitationPayload, id: "inv3", status: "cancelled" },
      ]),
    ]);
    mockApi(handle);

    const invitations = await getWorkspaceInvitations("ws1");

    expect(invitations.map((invitation) => invitation.id)).toEqual([
      "inv1",
      "inv2",
      "inv3",
    ]);
    expect(invitations.map((invitation) => invitation.status)).toEqual([
      "pending",
      "accepted",
      "cancelled",
    ]);
    expect(invitations[0]).toEqual(mappedInvitation);
  });

  it("acceptInvitation posts to the invitation route and returns the accepted state", async () => {
    const handle = createMockApiAdapter([
      suffixRoute("post", "/invitations/inv1/accept", {
        ...invitationPayload,
        status: "accepted",
      }),
    ]);
    mockApi(handle);

    await expect(acceptInvitation("inv1")).resolves.toMatchObject({
      id: "inv1",
      status: "accepted",
    });
    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/invitations/inv1/accept",
    });
  });

  it("declineInvitation posts to the invitation route and returns the declined state", async () => {
    const handle = createMockApiAdapter([
      suffixRoute("post", "/invitations/inv1/decline", {
        ...invitationPayload,
        status: "declined",
      }),
    ]);
    mockApi(handle);

    await expect(declineInvitation("inv1")).resolves.toMatchObject({
      id: "inv1",
      status: "declined",
    });
    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/invitations/inv1/decline",
    });
  });

  it("cancelInvitation posts the workspace-scoped cancel route and returns the cancelled state", async () => {
    const handle = createMockApiAdapter([
      suffixRoute("post", "/workspaces/ws1/invitations/inv1/cancel", {
        ...invitationPayload,
        status: "cancelled",
      }),
    ]);
    mockApi(handle);

    await expect(cancelInvitation("ws1", "inv1")).resolves.toMatchObject({
      id: "inv1",
      status: "cancelled",
    });
    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/workspaces/ws1/invitations/inv1/cancel",
    });
  });

  it("tolerates a response without the invitee email convenience field", async () => {
    const withoutEmail: Record<string, unknown> = { ...invitationPayload };
    delete withoutEmail.invitee_email;
    const handle = createMockApiAdapter([
      route("post", "/workspaces/ws1/invitations", withoutEmail, 201),
    ]);
    mockApi(handle);

    const invitation = await createInvitation("ws1", { userId: "u1" });

    expect(invitation.inviteeEmail).toBeUndefined();
    expect(invitation.inviteeUserId).toBe("u1");
  });

  it("rejects acceptInvitation with 403 when the caller is not the invitee", async () => {
    mockApi(
      createMockApiAdapter([
        suffixRoute("post", "/invitations/inv1/accept", "forbidden", 403),
      ]),
    );

    await expect(acceptInvitation("inv1")).rejects.toMatchObject({
      isAxiosError: true,
      response: { status: 403 },
    });
  });

  it("rejects acceptInvitation with 409 when the invitation is no longer pending", async () => {
    mockApi(
      createMockApiAdapter([
        suffixRoute("post", "/invitations/inv1/accept", "conflict", 409),
      ]),
    );

    // The bell treats this as "already resolved elsewhere" and drops the row
    // rather than offering a button that keeps failing.
    await expect(acceptInvitation("inv1")).rejects.toMatchObject({
      isAxiosError: true,
      response: { status: 409 },
    });
  });

  it("rejects declineInvitation with 403 and 409", async () => {
    mockApi(
      createMockApiAdapter([
        suffixRoute("post", "/invitations/inv1/decline", "forbidden", 403),
      ]),
    );
    await expect(declineInvitation("inv1")).rejects.toMatchObject({
      response: { status: 403 },
    });

    mockApi(
      createMockApiAdapter([
        suffixRoute("post", "/invitations/inv1/decline", "conflict", 409),
      ]),
    );
    await expect(declineInvitation("inv1")).rejects.toMatchObject({
      response: { status: 409 },
    });
  });
});