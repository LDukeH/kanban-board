import { describe, expect, it } from "vitest";
import { selectPendingInvitations } from "@/lib/pendingInvitations";
import type { Notification } from "@/types/notification";

const assigned: Notification = {
  id: "n-task",
  userId: "u1",
  type: "task_assigned",
  readAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  payload: {
    taskId: "t1",
    taskTitle: "Ship it",
    actorEmail: "ada@example.com",
  },
};

/** A `workspace_invited` notification as the mapper produces it. */
function invited(
  id: string,
  invitationId: string,
  workspaceId: string,
  overrides: {
    workspaceName?: string;
    actorEmail?: string;
    readAt?: string | null;
    createdAt?: string;
  } = {},
): Notification {
  return {
    id,
    userId: "u1",
    type: "workspace_invited",
    readAt: overrides.readAt ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    payload: {
      invitationId,
      workspaceId,
      workspaceName: overrides.workspaceName ?? `Workspace ${workspaceId}`,
      actorEmail: overrides.actorEmail ?? "owner@example.com",
    },
  };
}

const noContext = {
  accessibleWorkspaceIds: [] as string[],
  resolvedInvitationIds: [] as string[],
};

describe("selectPendingInvitations", () => {
  it("returns nothing for an empty or invitation-free list", () => {
    expect(selectPendingInvitations([], noContext)).toEqual([]);
    expect(
      selectPendingInvitations([assigned], noContext),
    ).toEqual([]);
  });

  it("keeps pending invitations in the order the backend returned them", () => {
    const list = [
      invited("n1", "inv1", "ws1"),
      invited("n2", "inv2", "ws2"),
    ];

    expect(
      selectPendingInvitations(list, noContext).map((p) => p.invitationId),
    ).toEqual(["inv1", "inv2"]);
  });

  it("never returns an invitation whose payload carried no id", () => {
    // A backend predating `invitation_id` maps it to "": the row must stay
    // read-only rather than become an action that would send a blank id.
    const result = selectPendingInvitations(
      [invited("n1", "", "ws1")],
      noContext,
    );

    expect(result).toEqual([]);
  });

  it("ignores notifications that are not workspace invitations", () => {
    const result = selectPendingInvitations(
      [assigned, invited("n1", "inv1", "ws1")],
      noContext,
    );

    expect(result.map((p) => p.invitationId)).toEqual(["inv1"]);
  });

  it("drops invitations resolved earlier in the session", () => {
    const result = selectPendingInvitations(
      [invited("n1", "inv1", "ws1"), invited("n2", "inv2", "ws2")],
      {
        accessibleWorkspaceIds: [],
        resolvedInvitationIds: ["inv1"],
      },
    );

    expect(result.map((p) => p.invitationId)).toEqual(["inv2"]);
  });

  it("drops invitations whose workspace the user can already access", () => {
    // The workspace being listed means the invitation was accepted (or the user
    // joined another way), so the notification is history, not a prompt.
    const result = selectPendingInvitations(
      [invited("n1", "inv1", "ws1"), invited("n2", "inv2", "ws2")],
      { accessibleWorkspaceIds: ["ws1"], resolvedInvitationIds: [] },
    );

    expect(result.map((p) => p.invitationId)).toEqual(["inv2"]);
  });

  it("collapses repeated announcements of one invitation, keeping the first", () => {
    const result = selectPendingInvitations(
      [
        invited("n1", "inv1", "ws1", { workspaceName: "Newest" }),
        invited("n2", "inv1", "ws1", { workspaceName: "Older" }),
      ],
      noContext,
    );

    expect(result).toHaveLength(1);
    expect(result[0].notificationId).toBe("n1");
    expect(result[0].workspaceName).toBe("Newest");
  });

  it("carries the fields the inbox renders, including the unread flag", () => {
    const [pending] = selectPendingInvitations(
      [
        invited("n1", "inv1", "ws1", {
          workspaceName: "Design Team",
          actorEmail: "ada@example.com",
          readAt: null,
          createdAt: "2026-02-02T00:00:00.000Z",
        }),
        invited("n2", "inv2", "ws2", { readAt: "2026-02-01T00:00:00.000Z" }),
      ],
      noContext,
    );

    expect(pending).toEqual({
      notificationId: "n1",
      invitationId: "inv1",
      workspaceId: "ws1",
      workspaceName: "Design Team",
      actorEmail: "ada@example.com",
      createdAt: "2026-02-02T00:00:00.000Z",
      isUnread: true,
    });
    expect(
      selectPendingInvitations(
        [invited("n2", "inv2", "ws2", { readAt: "2026-02-01T00:00:00.000Z" })],
        noContext,
      )[0].isUnread,
    ).toBe(false);
  });
});
