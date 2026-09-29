import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notification.api";
import type { Notification } from "@/types/notification";

export function notificationsUnreadCountQueryKey() {
  return ["notifications", "unread-count"] as const;
}

export function notificationsListQueryKey() {
  return ["notifications", "list"] as const;
}

function nowIso() {
  return new Date().toISOString();
}

/** Unread badge, polled every 30s and on window focus (no push backend). */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: notificationsUnreadCountQueryKey(),
    queryFn: getUnreadNotificationCount,
    retry: false,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

/** Shared by the bell and the invitation inbox: a pending invitation is the only notification the user must act on, so the window is the backend max. */
export function useNotificationsList(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: notificationsListQueryKey(),
    queryFn: () => getNotifications({ limit: 50, unreadOnly: false }),
    enabled: options.enabled,
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();

  function patchList(fn: (notification: Notification) => Notification) {
    queryClient
      .getQueryCache()
      .findAll({ queryKey: ["notifications", "list"] })
      .forEach((query) => {
        queryClient.setQueryData<Notification[]>(query.queryKey, (old) =>
          old ? old.map(fn) : old,
        );
      });
  }

  function setUnreadCount(count: number) {
    queryClient.setQueryData(
      notificationsUnreadCountQueryKey(),
      count,
    );
    queryClient.invalidateQueries({
      queryKey: notificationsUnreadCountQueryKey(),
    });
  }

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: (_void, notificationId) => {
      const readAt = nowIso();
      patchList((notification) =>
        notification.id === notificationId
          ? { ...notification, readAt }
          : notification,
      );
      const current = queryClient.getQueryData<number>(
        notificationsUnreadCountQueryKey(),
      );
      if (typeof current === "number") {
        setUnreadCount(Math.max(0, current - 1));
      }
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      const readAt = nowIso();
      patchList((notification) => ({ ...notification, readAt }));
      setUnreadCount(0);
    },
  });

  return {
    markRead: markReadMutation.mutateAsync,
    isMarkingRead: markReadMutation.isPending,
    markAllRead: markAllReadMutation.mutateAsync,
    isMarkingAllRead: markAllReadMutation.isPending,
  };
}