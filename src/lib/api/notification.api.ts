import { api } from "./axios";
import type {
  Notification,
  NotificationType,
  TaskAssignedPayload,
  WorkspaceInvitedPayload,
} from "@/types/notification";

interface NotificationApiResponse {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapTaskAssignedPayload(
  raw: Record<string, unknown>,
): TaskAssignedPayload {
  return {
    taskId: String(raw.task_id ?? ""),
    taskTitle: String(raw.task_title ?? ""),
    actorEmail: String(raw.actor_email ?? ""),
  };
}

function mapWorkspaceInvitedPayload(
  raw: Record<string, unknown>,
): WorkspaceInvitedPayload {
  return {
    workspaceId: String(raw.workspace_id ?? ""),
    workspaceName: String(raw.workspace_name ?? ""),
    actorEmail: String(raw.actor_email ?? ""),
  };
}

function mapNotification(raw: NotificationApiResponse): Notification {
  if (raw.type === "task_assigned") {
    return {
      id: raw.id,
      type: "task_assigned",
      payload: mapTaskAssignedPayload(raw.payload),
      readAt: raw.read_at,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    };
  }
  return {
    id: raw.id,
    type: "workspace_invited",
    payload: mapWorkspaceInvitedPayload(raw.payload),
    readAt: raw.read_at,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export const getNotifications = async ({
  limit = 20,
  unreadOnly = false,
}: { limit?: number; unreadOnly?: boolean } = {}): Promise<Notification[]> => {
  const response = await api.get<NotificationApiResponse[]>("/notifications", {
    params: { limit, unread_only: unreadOnly },
  });
  return response.data.map(mapNotification);
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  const response = await api.get<{ unread_count: number }>(
    "/notifications/unread-count",
  );
  return response.data.unread_count;
};

export const markNotificationRead = async (
  notificationId: string,
): Promise<void> => {
  await api.post(`/notifications/${notificationId}/read`);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await api.post("/notifications/read-all");
};