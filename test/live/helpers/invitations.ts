import {
  acceptInvitation,
  createInvitation,
  getWorkspaceInvitations,
} from "@/lib/api/invitation.api";
import { changeMemberRole, getWorkspaceMembers } from "@/lib/api/workspace.api";
import type { WorkspaceInvitation, WorkspaceMember } from "@/types/workspace";
import { loginAs, type LiveAccount } from "./session";

/**
 * Live fixture helpers for the invitation-based membership flow (§19.5).
 *
 * Membership can only be created by accepting an invitation, and the
 * acceptance has to run under the invitee's own session. Switching sessions is
 * therefore part of the fixture: the shared client ends logged in as `caller`,
 * ready for the rest of the suite.
 */

/** The workspace's current membership row for a user, or a failure. */
export async function findMembership(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMember> {
  const members = await getWorkspaceMembers(workspaceId);
  const membership = members.find((member) => member.userId === userId);
  if (!membership) {
    throw new Error(
      `Live fixture: user ${userId} has no membership in workspace ${workspaceId}`,
    );
  }
  return membership;
}

/** Owner/Admin: create an invitation without accepting it. */
export async function inviteUser(
  workspaceId: string,
  invitee: Pick<LiveAccount, "id">,
): Promise<WorkspaceInvitation> {
  return createInvitation(workspaceId, { userId: invitee.id });
}

/** The still-pending invitation for a user, resolved from the owner's session. */
export async function pendingInvitationFor(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceInvitation> {
  const invitations = await getWorkspaceInvitations(workspaceId);
  const pending = invitations.find(
    (invitation) =>
      invitation.inviteeUserId === userId && invitation.status === "pending",
  );
  if (!pending) {
    throw new Error(
      `Live fixture: no pending invitation for user ${userId} in workspace ${workspaceId}`,
    );
  }
  return pending;
}

export interface AcceptedInvitation {
  invitationId: string;
  membership: WorkspaceMember;
}

/**
 * Invites `invitee` (as the already-authenticated caller), switches to the
 * invitee to accept, then switches back to the caller and returns the created
 * membership.
 *
 * Acceptance always produces a `member` membership; pass `promoteToAdmin` to
 * additionally exercise the separate owner promotion step.
 */
export async function inviteAndAccept(
  workspaceId: string,
  invitee: LiveAccount,
  caller: Pick<LiveAccount, "email" | "password">,
  options: { promoteToAdmin?: boolean } = {},
): Promise<AcceptedInvitation> {
  const invitation = await inviteUser(workspaceId, invitee);

  await loginAs(invitee);
  const accepted = await acceptInvitation(invitation.id);
  if (accepted.status !== "accepted") {
    throw new Error(
      `Live fixture: invitation ${accepted.id} ended as ${accepted.status}`,
    );
  }

  await loginAs(caller);
  const membership = await findMembership(workspaceId, invitee.id);

  if (options.promoteToAdmin) {
    await changeMemberRole(workspaceId, membership.id, "admin");
    return {
      invitationId: invitation.id,
      membership: await findMembership(workspaceId, invitee.id),
    };
  }

  return { invitationId: invitation.id, membership };
}
