import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Workspace } from "@/types/workspace";
import {
  acceptInvitation,
  cancelInvitation,
  createInvitation,
  declineInvitation,
  getWorkspaceInvitations,
} from "@/lib/api/invitation.api";
import {
  changeMemberRole,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  getWorkspaces,
  removeMember,
} from "@/lib/api/workspace.api";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus, ISO_DATE_RE, UUID_RE } from "./helpers/http";
import { getNotifications } from "@/lib/api/notification.api";
import {
  findMembership,
  inviteUser,
  pendingInvitationFor,
} from "./helpers/invitations";
import {
  actingAs,
  deleteAccounts,
  installSessionManager,
  loginAs,
  provisionUser,
  type LiveAccount,
} from "./helpers/session";
import { uniqueName } from "./helpers/uniq";
import type { Notification } from "@/types/notification";

// Discriminated-union narrowing for the notification payloads.
const isWorkspaceInvited = (
  n: Notification,
): n is Extract<Notification, { type: "workspace_invited" }> =>
  n.type === "workspace_invited" &&
  n.payload.workspaceId !== "";

/**
 * Invitation lifecycle (§3.4 / §19.5): creation, listing, acceptance,
 * decline, cancellation, and the role promotion that follows acceptance.
 *
 * State is intentionally sequenced across tests (each step depends on the
 * previous one) — the live backend owns the invitation state machine.
 */
describe("live workspace invitation API", () => {
  let owner: LiveAccount;
  let invitee: LiveAccount;
  let memberAccount: LiveAccount;
  let decliner: LiveAccount;
  let outsider: LiveAccount;
  let workspace: Workspace;
  let invitationId: string;
  let inviteeMembershipId: string;
  // Accounts provisioned inside individual tests; deleted in the same teardown
  // as the beforeAll ones so a run leaves nothing behind in the dev database.
  const extraAccounts: LiveAccount[] = [];

  beforeAll(async () => {
    installSessionManager();
    await assertBackendReachable();

    owner = await provisionUser("inv-owner");
    invitee = await provisionUser("inv-invitee");
    memberAccount = await provisionUser("inv-member");
    decliner = await provisionUser("inv-decliner");
    outsider = await provisionUser("inv-outsider");

    await actingAs(owner, async () => {
      workspace = await createWorkspace({
        name: uniqueName("Live invitation workspace"),
      });
    });
  });

  afterAll(async () => {
    if (!owner) return; // setup aborted (backend down)

    // Order matters: the workspace must go first. Ownership lives in
    // `workspace_memberships` and the backend has no ownership-transfer
    // trigger, so deleting an owner would strand the workspace ownerless.
    if (workspace) {
      await loginAs(owner);
      await deleteWorkspace(workspace.id);
    }

    // Then every provisioned account. `users(id)` is referenced with
    // ON DELETE CASCADE from memberships, task_assignees, notifications,
    // comments and workspace_invitations, so this also clears the
    // `workspace_invited` notification rows the invitee-side tests produced.
    await deleteAccounts([
      owner,
      invitee,
      memberAccount,
      decliner,
      outsider,
      ...extraAccounts,
    ]);
  });

  it("creates a pending invitation without granting membership", async () => {
    await actingAs(owner, async () => {
      const invitation = await createInvitation(workspace.id, {
        userId: invitee.id,
      });
      invitationId = invitation.id;

      expect(invitation.id).toMatch(UUID_RE);
      expect(invitation.workspaceId).toBe(workspace.id);
      expect(invitation.inviteeUserId).toBe(invitee.id);
      expect(invitation.invitedByUserId).toBe(owner.id);
      expect(invitation.status).toBe("pending");
      expect(invitation.inviteeEmail).toBe(invitee.email);
      expect(invitation.createdAt).toMatch(ISO_DATE_RE);
      expect(invitation.expiresAt).toMatch(ISO_DATE_RE);

      // A pending invitation is not a membership (§3.4).
      const members = await getWorkspaceMembers(workspace.id);
      expect(members.map((m) => m.userId)).not.toContain(invitee.id);
    });
  });

  it("lists the workspace's invitations for the owner", async () => {
    await actingAs(owner, async () => {
      const invitations = await getWorkspaceInvitations(workspace.id);
      const listed = invitations.find((i) => i.id === invitationId);
      expect(listed).toBeDefined();
      expect(listed?.status).toBe("pending");

      // The helper resolves the pending row the way the UI must.
      const pending = await pendingInvitationFor(workspace.id, invitee.id);
      expect(pending.id).toBe(invitationId);
    });
  });

  it("rejects a duplicate pending invitation and an existing member (409)", async () => {
    await actingAs(owner, async () => {
      await expectStatus(
        createInvitation(workspace.id, { userId: invitee.id }),
        409,
      );
      await expectStatus(
        createInvitation(workspace.id, { userId: owner.id }),
        409,
      );
    });
  });

  it("lets only the invited user accept (403 for another user)", async () => {
    await actingAs(outsider, async () => {
      await expectStatus(acceptInvitation(invitationId), 403);
    });
  });

  it("hides the workspace from a pending invitee", async () => {
    // Documents the invitation-acceptance gap: a pending invitee cannot read
    // the workspace's invitations (no API path returns an invitee's own
    // invitation id) and has no member access yet.
    await actingAs(invitee, async () => {
      await expectStatus(getWorkspaceInvitations(workspace.id), 403);
      await expectStatus(getWorkspaceMembers(workspace.id), 403);
      await expectStatus(
        createInvitation(workspace.id, { userId: outsider.id }),
        403,
      );

      const workspaces = await getWorkspaces();
      expect(workspaces.map((w) => w.id)).not.toContain(workspace.id);
    });
  });

  it("creates exactly one member membership on acceptance", async () => {
    await actingAs(invitee, async () => {
      const accepted = await acceptInvitation(invitationId);
      expect(accepted.status).toBe("accepted");
      expect(accepted.id).toBe(invitationId);

      const workspaces = await getWorkspaces();
      expect(workspaces.map((w) => w.id)).toContain(workspace.id);

      const rows = (await getWorkspaceMembers(workspace.id)).filter(
        (m) => m.userId === invitee.id,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].role).toBe("member");
      inviteeMembershipId = rows[0].id;
    });

    await actingAs(invitee, async () => {
      // Accepting twice must not create a second membership.
      await expectStatus(acceptInvitation(invitationId), 409);
    });
  });

  it("promotes the accepted membership to admin", async () => {
    await actingAs(owner, async () => {
      const promoted = await changeMemberRole(
        workspace.id,
        inviteeMembershipId,
        "admin",
      );
      expect(promoted.role).toBe("admin");

      const members = await getWorkspaceMembers(workspace.id);
      expect(members.find((m) => m.userId === invitee.id)?.role).toBe("admin");
    });
  });

  it("lets the promoted admin invite, but a regular member cannot (403)", async () => {
    await loginAs(invitee);
    const invitation = await createInvitation(workspace.id, {
      userId: memberAccount.id,
    });
    expect(invitation.status).toBe("pending");

    await loginAs(memberAccount);
    await acceptInvitation(invitation.id);
    const membership = await findMembership(workspace.id, memberAccount.id);
    expect(membership.role).toBe("member");

    await expectStatus(
      createInvitation(workspace.id, { userId: decliner.id }),
      403,
    );
  });

  it("lets only an owner/admin cancel an invitation (403 for a member)", async () => {
    await loginAs(owner);
    const pending = await inviteUser(workspace.id, decliner);

    await loginAs(memberAccount);
    await expectStatus(cancelInvitation(workspace.id, pending.id), 403);

    await loginAs(owner);
    const cancelled = await cancelInvitation(workspace.id, pending.id);
    expect(cancelled.status).toBe("cancelled");

    const listed = await getWorkspaceInvitations(workspace.id);
    expect(listed.find((i) => i.id === pending.id)?.status).toBe("cancelled");
  });

  it("lets the invitee decline, which grants no access", async () => {
    await loginAs(owner);
    const pending = await inviteUser(workspace.id, outsider);

    await loginAs(outsider);
    const declined = await declineInvitation(pending.id);
    expect(declined.status).toBe("declined");

    await expectStatus(getWorkspaceMembers(workspace.id), 403);
    const workspaces = await getWorkspaces();
    expect(workspaces.map((w) => w.id)).not.toContain(workspace.id);
  });

  it("lets the invitee read their own inv-id from the notification and accept with it", async () => {
    // The acceptance gate for the invitee-side UI (docs/api/invitations.md).
    // The `workspace_invited` payload is the ONLY invitee-readable source of an
    // invitation id: the workspace invitation list answers 403 for a pending
    // invitee, and the backend exposes no "my invitations" route. If this test
    // fails, the frontend must fall back to the notice-only branch.
    const inviteeId = await provisionUser("inv-notify-invitee");
    extraAccounts.push(inviteeId);
    let invitedInvitationId = "";
    let acceptedMembershipId = "";

    await actingAs(owner, async () => {
      const pending = await inviteUser(workspace.id, inviteeId);
      invitedInvitationId = pending.id;
    });

    await actingAs(inviteeId, async () => {
      const invited = (await getNotifications()).find(isWorkspaceInvited);
      expect(invited).toBeDefined();
      expect(invited?.payload.invitationId).toBe(invitedInvitationId);
      expect(invited?.payload.invitationId).toMatch(UUID_RE);

      // The id read from the payload must be directly usable to accept.
      const accepted = await acceptInvitation(invited!.payload.invitationId);
      expect(accepted.status).toBe("accepted");
      expect(accepted.id).toBe(invitedInvitationId);

      const membership = await findMembership(workspace.id, inviteeId.id);
      expect(membership.role).toBe("member");
      acceptedMembershipId = membership.id;
      expect((await getWorkspaces()).map((w) => w.id)).toContain(workspace.id);
      expect(
        (await getNotifications()).some(
          (notification) =>
            isWorkspaceInvited(notification) &&
            notification.payload.invitationId === invitedInvitationId,
        ),
      ).toBe(false);

      await actingAs(owner, async () => {
        await removeMember(workspace.id, acceptedMembershipId);
      });
    });

    await actingAs(inviteeId, async () => {
      expect((await getWorkspaces()).map((w) => w.id)).not.toContain(
        workspace.id,
      );
      expect(
        (await getNotifications()).some(
          (notification) =>
            isWorkspaceInvited(notification) &&
            notification.payload.invitationId === invitedInvitationId,
        ),
      ).toBe(false);
    });
  });

  it("lets the invitee decline from the notification payload", async () => {
    const declinerId = await provisionUser("inv-notify-decliner");
    extraAccounts.push(declinerId);
    let invitationId = "";

    await actingAs(owner, async () => {
      invitationId = (await inviteUser(workspace.id, declinerId)).id;
    });

    await actingAs(declinerId, async () => {
      const invited = (await getNotifications()).find(isWorkspaceInvited);
      expect(invited?.payload.invitationId).toBe(invitationId);

      const declined = await declineInvitation(invited!.payload.invitationId);
      expect(declined.status).toBe("declined");

      // Declining grants no access.
      await expectStatus(getWorkspaceMembers(workspace.id), 403);
      expect((await getWorkspaces()).map((w) => w.id)).not.toContain(workspace.id);
    });
  });

  it("allows re-inviting a user whose membership was removed", async () => {
    await actingAs(owner, async () => {
      const membership = await findMembership(workspace.id, memberAccount.id);
      await removeMember(workspace.id, membership.id);

      const reinvited = await inviteUser(workspace.id, memberAccount);
      expect(reinvited.status).toBe("pending");
      expect(reinvited.inviteeUserId).toBe(memberAccount.id);
    });
  });
});
