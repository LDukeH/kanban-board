export type NotificationType = "task_assigned" | "workspace_invited";

export interface TaskAssignedPayload {
  taskId: string;
  taskTitle: string;
  actorEmail: string;
}

export interface WorkspaceInvitedPayload {
  // `invitation_id` is the only invitee-readable source of an invitation id; a pending invitee gets 403 from the workspace invitation list and no
  // "my invitations" route exists. Mapped tolerantly: `""` means a backend predating the field, and consumers must treat that as "no actions available".
  invitationId: string;
  workspaceId: string;
  workspaceName: string;
  actorEmail: string;
}

interface NotificationBase {
  id: string;
  /** User who owns/receives this notification. */
  userId: string;
  /** ISO-8601 timestamp; null while unread. */
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Discriminated union on `type` so the payload narrows when switching on it. */
export type Notification =
  | (NotificationBase & {
      type: "task_assigned";
      payload: TaskAssignedPayload;
    })
  | (NotificationBase & {
      type: "workspace_invited";
      payload: WorkspaceInvitedPayload;
    });