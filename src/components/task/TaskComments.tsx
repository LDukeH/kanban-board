import { useState } from "react";
import { Loader2, MessageCircle, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Textarea } from "@/components/ui/textarea";
import { InlineAlert } from "@/components/ui/inline-alert";
import { useTaskComments } from "@/hooks/useTaskComments";
import {
  describeLoadError,
  describeMutationError,
} from "@/lib/httpStatus";
import { avatarGradient, avatarSeed, emailInitial } from "@/lib/memberDisplay";
import { formatRelativeTime } from "@/lib/relativeTime";
import { cn } from "@/lib/utils";
import {
  COMMENT_CONTENT_MAX_LENGTH,
  validateCommentContent,
} from "@/lib/validations/comment.schema";
import type { Comment } from "@/types/board";

interface TaskCommentsProps {
  taskId: string;
  /** Only fetch while the task surface (dialog) is open. */
  enabled?: boolean;
  currentUserId?: string;
  currentUserEmail?: string;
  /** Owner/admin can delete any comment; everyone else only their own. */
  canDeleteAnyComment?: boolean;
}

export function TaskComments({
  taskId,
  enabled = false,
  currentUserId,
  currentUserEmail = "",
  canDeleteAnyComment = false,
}: TaskCommentsProps) {
  const {
    comments,
    isLoadingComments,
    isCommentsError,
    commentsError,
    refetchComments,
    createComment,
    isCreatingComment,
    deleteComment,
    isDeletingComment,
  } = useTaskComments(taskId, { enabled });

  const [draft, setDraft] = useState("");
  const [deleting, setDeleting] = useState<Comment | null>(null);
  // Comment failures report under the composer, so the reason a post did not
  // happen stays readable after the click.
  const [error, setError] = useState<string | null>(null);

  const trimmedLength = draft.trim().length;
  const isTooLong = trimmedLength > COMMENT_CONTENT_MAX_LENGTH;

  async function handleSubmit() {
    const content = draft.trim();
    const validationMessage = validateCommentContent(content);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }
    setError(null);
    try {
      await createComment({ content });
      setDraft("");
    } catch (err) {
      setError(
        describeMutationError(err, "Failed to post comment. Please try again."),
      );
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 pb-3">
        <MessageCircle className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Comments</h3>
        {!isLoadingComments && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {comments.length}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-start gap-2.5 pb-4">
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white",
            avatarGradient(avatarSeed({ email: currentUserEmail })),
          )}
        >
          {emailInitial(currentUserEmail || "?")}
        </span>
        <div className="min-w-0 flex-1">
          <Textarea
            value={draft}
            rows={2}
            maxLength={COMMENT_CONTENT_MAX_LENGTH}
            placeholder="Write a comment"
            aria-label="Comment"
            disabled={isCreatingComment}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            className="max-h-40 resize-none"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={cn(
                "text-[11px] tabular-nums",
                isTooLong ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {trimmedLength}/{COMMENT_CONTENT_MAX_LENGTH}
            </span>
            <div className="min-w-0 flex-1" />
            <Button
              type="button"
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={isCreatingComment || trimmedLength === 0 || isTooLong}
            >
              {isCreatingComment && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              <Send className="size-3.5" />
              Comment
            </Button>
          </div>
          {error && (
            <InlineAlert
              message={error}
              onDismiss={() => setError(null)}
              className="mt-2"
            />
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {isLoadingComments ? (
          <div className="flex h-full items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : isCommentsError ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <p className="text-xs font-medium text-muted-foreground">
              Couldn't load comments
            </p>
            <p className="max-w-56 text-[11px] leading-relaxed text-muted-foreground/80">
              {describeLoadError(commentsError)}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetchComments()}
            >
              Try again
            </Button>
          </div>
        ) : comments.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <MessageCircle className="size-6 text-muted-foreground/60" />
            <p className="text-xs font-medium text-muted-foreground">
              No comments yet
            </p>
            <p className="max-w-56 text-[11px] leading-relaxed text-muted-foreground/80">
              Write a comment above to start the discussion on this card.
            </p>
          </div>
        ) : (
          <ul className="flex h-full max-h-full flex-col gap-2.5 overflow-y-auto pr-1">
            {comments.map((comment) => {
              const canDelete =
                canDeleteAnyComment || comment.authorId === currentUserId;
              return (
                <li key={comment.id} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-semibold text-white",
                      avatarGradient(
                        avatarSeed({ email: comment.authorEmail }),
                      ),
                    )}
                  >
                    {emailInitial(comment.authorEmail)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                        {comment.authorEmail}
                      </span>
                      <time
                        className="shrink-0 text-[11px] text-muted-foreground"
                        dateTime={comment.createdAt}
                        title={comment.createdAt}
                      >
                        {formatRelativeTime(comment.createdAt)}
                      </time>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleting(comment)}
                          aria-label={`Delete comment by ${comment.authorEmail}`}
                          title="Delete comment"
                          className="text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                      {comment.content}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete comment"
        description={
          deleting
            ? `Delete this comment by ${deleting.authorEmail}? This cannot be undone.`
            : "Delete this comment? This cannot be undone."
        }
        onConfirm={async () => {
          if (deleting) {
            await deleteComment(deleting.id);
          }
        }}
        isLoading={isDeletingComment}
      />
    </div>
  );
}
