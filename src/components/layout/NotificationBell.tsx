import { useState } from "react";
import { Bell, BellRing, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  useNotificationActions,
  useNotificationsList,
  useUnreadNotificationCount,
} from "@/hooks/useNotifications";
import { findBoardIdForTask } from "@/lib/api/task.api";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/relativeTime";
import { emailInitial, avatarGradient } from "@/lib/memberDisplay";
import type { Notification } from "@/types/notification";

function notificationCopy(notification: Notification): {
  actorEmail: string;
  message: string;
} {
  switch (notification.type) {
    case "task_assigned":
      return {
        actorEmail: notification.payload.actorEmail,
        message: `assigned you to “${notification.payload.taskTitle}”`,
      };
    case "workspace_invited":
      return {
        actorEmail: notification.payload.actorEmail,
        message: `added you to “${notification.payload.workspaceName}”`,
      };
  }
}

/**
 * Sidebar bell: polled unread badge and a dropdown list. Opening an item
 * marks it read and navigates to the referenced resource.
 */
export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const unreadQuery = useUnreadNotificationCount();
  const listQuery = useNotificationsList({ enabled: open });
  const { markRead, markAllRead } = useNotificationActions();

  const unreadCount = unreadQuery.data ?? 0;
  const notifications = listQuery.data ?? [];
  const unreadItems = notifications.filter((n) => n.readAt === null).length;
  const isListLoading = listQuery.isLoading || listQuery.isFetching;

  function openNotification(notification: Notification) {
    if (notification.readAt === null) {
      void markRead(notification.id).catch(() =>
        toast.error("Could not mark the notification as read."),
      );
    }

    switch (notification.type) {
      case "task_assigned": {
        // Resolve the owning board (the payload carries only a task id).
        void findBoardIdForTask(notification.payload.taskId).then((boardId) => {
          if (boardId) {
            navigate(`/boards/${boardId}`);
          } else {
            toast.error("This task's board could not be opened.");
          }
        });
        break;
      }
      case "workspace_invited":
        navigate(`/workspaces/${notification.payload.workspaceId}`);
        break;
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger>
        <span
          className={cn(
            "relative inline-flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            unreadCount > 0
              ? "text-sidebar-accent-foreground"
              : "text-sidebar-foreground",
            className,
          )}
          title="Notifications"
          aria-label="Notifications"
        >
          {unreadCount > 0 ? (
            <BellRing className="size-4.5" />
          ) : (
            <Bell className="size-4.5" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground ring-2 ring-sidebar">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-104"
        style={{ maxHeight: "min(70vh, 520px)" }}
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-sm font-semibold text-foreground">
            Notifications
          </span>
          {unreadItems > 0 && (
            <button
              type="button"
              onClick={() =>
                void markAllRead().catch(() =>
                  toast.error("Could not mark notifications as read."),
                )
              }
              className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="Mark all notifications as read"
            >
              <Check className="size-3.5" />
              Mark all as read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        <div className="max-h-[380px] overflow-y-auto">
          {isListLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : listQuery.isError ? (
            <div className="flex flex-col items-center justify-center gap-2 px-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Couldn't load notifications.
              </p>
              <button
                type="button"
                onClick={() => {
                  void listQuery.refetch();
                }}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Retry
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
              <Bell className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <div className="space-y-px">
              {notifications.map((notification) => {
                const unread = notification.readAt === null;
                const { actorEmail, message } = notificationCopy(notification);
                return (
                  <DropdownMenuItem
                    key={notification.id}
                    className="cursor-pointer items-center gap-2 py-2.5 pl-2 pr-3 hover:bg-accent hover:text-accent-foreground"
                    onClick={() => openNotification(notification)}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "mt-1 size-2 shrink-0 rounded-full",
                        unread ? "bg-primary" : "bg-transparent",
                      )}
                    />
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white",
                        avatarGradient(actorEmail),
                      )}
                    >
                      {emailInitial(actorEmail)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={cn(
                          "truncate text-sm",
                          unread
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        <strong className="font-semibold">{actorEmail}</strong>{" "}
                        {message}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
