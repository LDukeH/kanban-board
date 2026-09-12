export type NotificationType = "task_assigned" | "workspace_invited";

export interface TaskAssignedPayload {
  taskId: string;
  taskTitle: string;
  actorEmail: string;
}

export interface WorkspaceInvitedPayload {
  workspaceId: string;
  workspaceName: string;
  actorEmail: string;
}

interface NotificationBase {
  id: string;
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