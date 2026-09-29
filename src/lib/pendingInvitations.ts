import type { Notification } from "@/types/notification";

/** The notification shape that can carry an invitation id. */
export type WorkspaceInvitedNotification = Extract<
  Notification,
  { type: "workspace_invited" }
>;

// A `workspace_invited` row is still actionable only while the invitation is unresolved and the user lacks access to the workspace.
export interface PendingInvitation {
  /** The notification carrying this invitation; marked read once resolved. */
  notificationId: string;
  invitationId: string;
  workspaceId: string;
  workspaceName: string;
  /** The inviter's email — the notification's actor. */
  actorEmail: string;
  createdAt: string;
  /** The notification has not been read, so it still drives the bell badge. */
  isUnread: boolean;
}

export interface PendingInvitationOptions {
  // Membership here means the invitation was already accepted, so the row is history rather than a prompt.
  accessibleWorkspaceIds: Iterable<string>;
  // Notifications are immutable and never deleted, so without this a resolved invitation reappears and every request 409s.
  resolvedInvitationIds: Iterable<string>;
}

function toSet(values: Iterable<string>): Set<string> {
  return values instanceof Set ? values : new Set(values);
}

// Preserves the caller's newest-first order; the first (newest) occurrence wins when one invitation is announced twice.
export function selectPendingInvitations(
  notifications: Notification[],
  { accessibleWorkspaceIds, resolvedInvitationIds }: PendingInvitationOptions,
): PendingInvitation[] {
  const accessible = toSet(accessibleWorkspaceIds);
  const resolved = toSet(resolvedInvitationIds);
  const seen = new Set<string>();

  const pending: PendingInvitation[] = [];

  for (const notification of notifications) {
    if (notification.type !== "workspace_invited") continue;

    const { invitationId, workspaceId, workspaceName, actorEmail } =
      notification.payload;

    // A backend that predates `invitation_id` maps it to "". Such a row stays
    // a read-only notice in the notification list; it is never actionable and
    // must never produce a request with a blank id.
    if (!invitationId) continue;

    // Already resolved in this session, or the workspace shows up in the user's
    // list because the invitation was accepted.
    if (resolved.has(invitationId) || accessible.has(workspaceId)) continue;

    if (seen.has(invitationId)) continue;
    seen.add(invitationId);

    pending.push({
      notificationId: notification.id,
      invitationId,
      workspaceId,
      workspaceName,
      actorEmail,
      createdAt: notification.createdAt,
      isUnread: notification.readAt === null,
    });
  }

  return pending;
}