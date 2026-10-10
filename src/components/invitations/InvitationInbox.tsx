import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, MailQuestion, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InlineAlert,
  type InlineAlertTone,
} from "@/components/ui/inline-alert";
import {
  useNotificationActions,
  useNotificationsList,
} from "@/hooks/useNotifications";
import { useInvitationActions, useWorkspaces } from "@/hooks/useWorkspaces";
import { useInvitationStore } from "@/stores/invitationStore";
import {
  selectPendingInvitations,
  type PendingInvitation,
} from "@/lib/pendingInvitations";
import { emailInitial, avatarGradient, avatarSeed } from "@/lib/memberDisplay";
import { formatRelativeTime } from "@/lib/relativeTime";
import { describeMutationError, getHttpStatus } from "@/lib/httpStatus";
import { cn } from "@/lib/utils";

/** Invitee inbox on the Workspaces page: the surface that resolves invitations, given a persistent home because the bell dropdown closes on navigation. */
export function InvitationInbox({ className }: { className?: string }) {
  const [notice, setNotice] = useState<{
    tone: InlineAlertTone;
    message: string;
  } | null>(null);
  // Invitation id currently being resolved, so only that row shows a spinner
  // and the other invitations stay usable.
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetched on mount, since an invitation only actionable behind a dropdown click is one users never resolve; the shared key avoids a duplicate request.
  const listQuery = useNotificationsList({ enabled: true });
  const { workspaces } = useWorkspaces();
  const { markRead } = useNotificationActions();
  const { resolved, markResolved } = useInvitationStore();
  const { acceptInvitation, isAccepting, declineInvitation, isDeclining } =
    useInvitationActions();

  const isResolving = isAccepting || isDeclining;

  const pending = selectPendingInvitations(listQuery.data ?? [], {
    accessibleWorkspaceIds: workspaces.map((workspace) => workspace.id),
    resolvedInvitationIds: Object.keys(resolved),
  });

  function resolve(
    invitation: PendingInvitation,
    action: "accept" | "decline",
  ) {
    const {
      invitationId,
      workspaceId,
      workspaceName,
      notificationId,
      isUnread,
    } = invitation;
    if (!invitationId || isResolving) return;
    setNotice(null);
    setBusyInvitationId(invitationId);

    // Resolving the invitation settles the prompt, so its notification stops
    // being an unread bell entry.
    if (isUnread) {
      void markRead(notificationId).catch(() => {
        setNotice({
          tone: "error",
          message: "Could not mark the notification as read.",
        });
      });
    }

    const run = action === "accept" ? acceptInvitation : declineInvitation;
    void run({ invitationId, workspaceId })
      .then((resolvedInvitation) => {
        markResolved(
          invitationId,
          resolvedInvitation.status === "declined" ? "declined" : "accepted",
        );
        if (action === "accept") {
          // The workspace is already in the cache (useInvitationActions
          // invalidates `['workspaces']`), so go straight there.
          navigate(`/workspaces/${workspaceId}`);
        }
      })
      .catch((error: unknown) => {
        const status = getHttpStatus(error);
        if (status === 409) {
          // Resolved or expired elsewhere. Record it so the row stops offering
          // buttons that would keep failing.
          markResolved(invitationId, "declined");
          setNotice({
            tone: "info",
            message: `This invitation to “${workspaceName}” was already resolved or has expired.`,
          });
          return;
        }
        if (status === 403) {
          setNotice({
            tone: "error",
            message: "Only the invited user can respond to this invitation.",
          });
          return;
        }
        setNotice({
          tone: "error",
          message: describeMutationError(
            error,
            `Could not ${
              action === "accept" ? "join" : "decline the invitation to"
            } “${workspaceName}”. Please try again.`,
          ),
        });
      })
      .finally(() => setBusyInvitationId(null));
  }

  // A failure to load the list must not silently hide the one surface that can
  // resolve an invitation, so it is reported here instead of vanishing.
  if (listQuery.isError) {
    return (
      <InlineAlert
        message="Couldn't load your invitations."
        className={className}
      >
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 gap-1.5"
          onClick={() => {
            void listQuery.refetch();
          }}
        >
          {listQuery.isFetching ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : null}
          {listQuery.isFetching ? "Retrying…" : "Retry"}
        </Button>
      </InlineAlert>
    );
  }

  // Nothing to decide: render nothing, so the page keeps its layout for the 99% of users without a pending invitation.
  if (pending.length === 0) return null;

  return (
    <section
      aria-label="Pending workspace invitations"
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <header className="mb-2 flex items-center gap-2">
        <MailQuestion className="size-4 shrink-0 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">
          Pending invitations
        </h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          {pending.length}
        </span>
      </header>

      {notice && (
        <InlineAlert
          message={notice.message}
          tone={notice.tone}
          onDismiss={() => setNotice(null)}
          className="mb-3"
        />
      )}

      <ul className="divide-y divide-border">
        {pending.map((invitation) => {
          const busy = busyInvitationId === invitation.invitationId;
          return (
            <li
              key={invitation.invitationId}
              className="flex flex-wrap items-center gap-3 py-3 first:pt-1 last:pb-1"
            >
              <div
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-xs font-semibold text-white",
                  avatarGradient(avatarSeed({ email: invitation.actorEmail })),
                )}
              >
                {emailInitial(invitation.actorEmail)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {invitation.workspaceName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Invited by {invitation.actorEmail} ·{" "}
                  {formatRelativeTime(invitation.createdAt)}
                </p>
              </div>
              {invitation.isUnread && (
                <span
                  aria-label="Unread"
                  className="size-2 shrink-0 rounded-full bg-primary"
                />
              )}
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  disabled={isResolving}
                  onClick={() => resolve(invitation, "accept")}
                >
                  {busy && isAccepting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isResolving}
                  onClick={() => resolve(invitation, "decline")}
                >
                  {busy && isDeclining ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                  Decline
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
