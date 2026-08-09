import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LabelBadge } from "@/components/board/LabelBadge";
import { CreateLabelDialog } from "@/components/board/CreateLabelDialog";
import { EditLabelDialog } from "@/components/board/EditLabelDialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useBoard } from "@/hooks/useBoard";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { describeLoadError } from "@/lib/httpStatus";
import { Tags, Pencil, Trash2, Loader2 } from "lucide-react";

interface BoardLabelsPopoverProps {
  boardId: string;
}

/**
 * Compact header button that opens a popover dropdown for managing
 * board labels (view / create / edit / delete). Only visible to users
 * with label-management permission.
 */
export function BoardLabelsPopover({
  boardId,
}: BoardLabelsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { board, labels, isLoadingLabels, isLabelsError, labelsError, deleteLabel, isDeletingLabel } =
    useBoard(boardId);
  const { canManageLabels } = useWorkspaceAccess(board?.workspaceId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingLabelId(null);
        setDeletingLabelId(null);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  if (!canManageLabels) return null;

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Tags className="size-3.5" />
        Labels
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-border bg-card shadow-lg">
          <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground">
            <Tags className="size-3.5" />
            Board Labels
          </div>

          <div className="max-h-64 overflow-y-auto border-t border-border px-1.5 py-1">
            {isLoadingLabels ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : isLabelsError ? (
              <p className="px-1 py-2 text-xs text-destructive">
                {describeLoadError(labelsError)}
              </p>
            ) : labels.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">No labels yet.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {labels.map((label) => (
                  <div
                    key={label.id}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1.5 hover:bg-muted"
                  >
                    <LabelBadge label={label} className="flex-1 justify-start text-[11px]" />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0"
                      onClick={() => setEditingLabelId(label.id)}
                      aria-label={`Edit ${label.name}`}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <ConfirmDeleteDialog
                      title="Delete Label"
                      description={`Are you sure you want to delete "${label.name}"? It will be removed from every task on this board.`}
                      onConfirm={() => deleteLabel(label.id)}
                      isLoading={isDeletingLabel}
                      open={deletingLabelId === label.id}
                      onOpenChange={(next) => setDeletingLabelId(next ? label.id : null)}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="shrink-0"
                          aria-label={`Delete ${label.name}`}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border p-1.5">
            <CreateLabelDialog
              boardId={boardId}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <span className="text-base leading-none">+</span>
                  Create new label
                </Button>
              }
            />
          </div>
        </div>
      )}

      {editingLabelId && (
        <EditLabelDialog
          label={labels.find((l) => l.id === editingLabelId)!}
          open={!!editingLabelId}
          onOpenChange={(next) => setEditingLabelId(next ? editingLabelId : null)}
        />
      )}
    </div>
  );
}
