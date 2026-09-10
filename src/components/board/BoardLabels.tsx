import { useBoard } from "@/hooks/useBoard";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { LabelBadge } from "@/components/board/LabelBadge";
import { CreateLabelDialog } from "@/components/dialog/CreateLabelDialog";
import { EditLabelDialog } from "@/components/dialog/EditLabelDialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { describeLoadError } from "@/lib/httpStatus";
import { Loader2, Tags, Trash2 } from "lucide-react";

interface BoardLabelsProps {
  boardId: string;
}

/**
 * Board-scoped Label management strip (view / create / edit / delete).
 * Only shown to users who can manage Labels (Owner/Admin); the backend
 * remains authoritative.
 */
export function BoardLabels({ boardId }: BoardLabelsProps) {
  const {
    board,
    labels,
    isLoadingLabels,
    isLabelsError,
    labelsError,
    deleteLabel,
    isDeletingLabel,
  } = useBoard(boardId);
  const { canManageLabels } = useWorkspaceAccess(board?.workspaceId);

  if (!canManageLabels) return null;

  return (
    <div className="shrink-0 border-b border-border bg-muted/40 px-6 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Tags className="size-3.5" />
          Labels
        </span>

        {isLoadingLabels ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : isLabelsError ? (
          <span className="text-xs text-destructive">{describeLoadError(labelsError)}</span>
        ) : (
          <>
            {labels.length === 0 && (
              <span className="text-xs text-muted-foreground">No labels yet.</span>
            )}

            {labels.map((label) => (
              <div key={label.id} className="flex items-center gap-0.5">
                <LabelBadge label={label} />
                <EditLabelDialog label={label} />
                <ConfirmDeleteDialog
                  title="Delete Label"
                  description={`Are you sure you want to delete "${label.name}"? It will be removed from every task on this board.`}
                  successMessage={`Label “${label.name}” deleted`}
                  onConfirm={() => deleteLabel(label.id)}
                  isLoading={isDeletingLabel}
                  trigger={
                    <Button variant="ghost" size="icon-xs">
                      <Trash2 className="size-3" />
                    </Button>
                  }
                />
              </div>
            ))}

            <CreateLabelDialog boardId={boardId} />
          </>
        )}
      </div>
    </div>
  );
}
