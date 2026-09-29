import { useState } from "react";
import { Bell, BellRing, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  InlineAlert,
  type InlineAlertTone,
} from "@/components/ui/inline-alert";
import {
  useNotificationActions,
  useNotificationsList,
  useUnreadNotificationCount,
} from "@/hooks/useNotifications";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useInvitationStore } from "@/stores/invitationStore";
import { selectPendingInvitations } from "@/lib/pendingInvitations";
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
        message: `invited you to “${notification.payload.workspaceName}”`,
      };
  }
}

/** Sidebar bell: polled unread badge plus a dropdown list; opening an item marks it read and navigates. */
export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  // Notification actions report inside the panel so the reason a click did
  // nothing stays readable while it is open (e.g. a task's board could not be
  // resolved).
  const [notice, setNotice] = useState<{
    tone: InlineAlertTone;
    message: string;
  } | null>(null);
  // Invitation resolution lives on the Workspaces page; the bell only recognises a still-pending invitation to point at the inbox, via the same shared helper.
  const { resolved } = useInvitationStore();
  const navigate = useNavigate();

  const unreadQuery = useUnreadNotificationCount();
  const listQuery = useNotificationsList({ enabled: open });
  const { workspaces } = useWorkspaces();
  const { markRead, markAllRead } = useNotificationActions();

  const unreadCount = unreadQuery.data ?? 0;
  const notifications = listQuery.data ?? [];
  const unreadItems = notifications.filter((n) => n.readAt === null).length;
  const isListLoading = listQuery.isLoading || listQuery.isFetching;

  // A `workspace_invited` notification is only actionable while the
  // invitation is still pending and unresolved. Everything else is history.
  const pendingInvitationIds = new Set(
    selectPendingInvitations(notifications, {
      accessibleWorkspaceIds: workspaces.map((workspace) => workspace.id),
      resolvedInvitationIds: Object.keys(resolved),
    }).map((invitation) => invitation.invitationId),
  );

  function openNotification(notification: Notification) {
    setNotice(null);
    if (notification.readAt === null) {
      void markRead(notification.id).catch(() => {
        setNotice({
          tone: "error",
          message: "Could not mark the notification as read.",
        });
      });
    }

    switch (notification.type) {
      case "task_assigned": {
        // Resolve the owning board (the payload carries only a task id).
        void findBoardIdForTask(notification.payload.taskId).then((boardId) => {
          if (boardId) {
            navigate(`/boards/${boardId}`);
          } else {
            setNotice({
              tone: "error",
              message: "This task's board could not be opened.",
            });
          }
        });
        break;
      }
      case "workspace_invited": {
        const { workspaceId, workspaceName, invitationId } =
          notification.payload;
        // A pending invitation grants no workspace access (§3.4), so navigating would 403; only open it once the user actually has access.
        if (workspaces.some((workspace) => workspace.id === workspaceId)) {
          navigate(`/workspaces/${workspaceId}`);
          break;
        }
        // Still pending, and the payload carried an invitation id: send the
        // user to the inbox that can actually resolve it.
        if (invitationId) {
          goToInvitations(notification);
          break;
        }
        // No id — a backend that predates the field. The notification is
        // display-only, so explain the situation instead of offering actions
        // that cannot work.
        setNotice({
          tone: "info",
          message: `You've been invited to “${workspaceName}”. It appears in your workspaces once the invitation is accepted.`,
        });
        break;
      }
    }
  }

  // The bell points at the inbox rather than resolving invitations here: the dropdown unmounts on navigation, losing the decision.
  function goToInvitations(notification: Notification) {
    setNotice(null);
    if (notification.readAt === null) {
      void markRead(notification.id).catch(() => {
        setNotice({
          tone: "error",
          message: "Could not mark the notification as read.",
        });
      });
    }
    navigate("/workspaces");
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
              onClick={() => {
                setNotice(null);
                void markAllRead().catch(() => {
                  setNotice({
                    tone: "error",
                    message: "Could not mark notifications as read.",
                  });
                });
              }}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label="Mark all notifications as read"
            >
              <Check className="size-3.5" />
              Mark all as read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />

        {notice && (
          <div className="px-2 pb-1.5">
            <InlineAlert
              message={notice.message}
              tone={notice.tone}
              onDismiss={() => setNotice(null)}
            />
          </div>
        )}

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

                // A still-pending `workspace_invited` notification is the one row
                // that needs a decision. The bell only points at the inbox now —
                // the derivation is shared with it so both agree on which
                // invitations are actionable.
                const isPendingInvitation =
                  notification.type === "workspace_invited" &&
                  pendingInvitationIds.has(notification.payload.invitationId);

                const row = (
                  <>
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
                  </>
                );

                if (isPendingInvitation) {
                  // A plain menu item again, now that the row is a pointer
                  // rather than an action surface: it navigates to the
                  // Workspaces page, and the dropdown closing on navigation is
                  // the desired behaviour.
                  return (
                    <DropdownMenuItem
                      key={notification.id}
                      className="cursor-pointer items-center gap-2 py-2.5 pl-2 pr-3 hover:bg-accent hover:text-accent-foreground"
                      onClick={() => goToInvitations(notification)}
                    >
                      {row}
                      <span className="ml-1 shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Pending
                      </span>
                    </DropdownMenuItem>
                  );
                }

                return (
                  <DropdownMenuItem
                    key={notification.id}
                    className="cursor-pointer items-center gap-2 py-2.5 pl-2 pr-3 hover:bg-accent hover:text-accent-foreground"
                    onClick={() => openNotification(notification)}
                    // Keep the panel open so a notice raised by the click (a
                    // failed board lookup, a mark-read failure) stays on screen;
                    // navigating away unmounts the panel anyway.
                    closeOnClick={false}
                  >
                    {row}
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
