import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LabelBadge } from "@/components/board/LabelBadge";
import { CreateLabelDialog } from "@/components/board/CreateLabelDialog";
import { EditLabelDialog } from "@/components/board/EditLabelDialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBoard } from "@/hooks/useBoard";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { describeLoadError } from "@/lib/httpStatus";
import { Tags, Pencil, Trash2, Plus, Loader2 } from "lucide-react";

interface BoardLabelsPopoverProps {
  boardId: string;
}

/**
 * Compact header button that opens a dropdown-menu for managing
 * board labels (view / create / edit / delete). Only visible to users
 * with label-management permission.
 */
export function BoardLabelsPopover({ boardId }: BoardLabelsPopoverProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground hover:bg-muted py-1 px-2 rounded-md transition-colors cursor-pointer">
            <Tags className="size-3.5" />
            Labels
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Board Labels</DropdownMenuLabel>
            {isLoadingLabels ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : isLabelsError ? (
              <p className="px-2 py-1.5 text-xs text-destructive">
                {describeLoadError(labelsError)}
              </p>
            ) : labels.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                No labels yet.
              </p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {labels.map((label) => (
                  <div
                    key={label.id}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1.5 hover:bg-muted"
                  >
                    <LabelBadge
                      label={label}
                      className="flex-1 justify-start text-[11px]"
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0"
                      aria-label={`Edit ${label.name}`}
                      onClick={() => {
                        setEditingLabelId(label.id);
                        setMenuOpen(false);
                      }}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0"
                      aria-label={`Delete ${label.name}`}
                      onClick={() => {
                        setDeletingLabelId(label.id);
                        setMenuOpen(false);
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsCreating(true)}>
            <Plus className="size-3.5" />
            Create new label
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editingLabelId && (
        <EditLabelDialog
          label={labels.find((l) => l.id === editingLabelId)!}
          open={!!editingLabelId}
          onOpenChange={(next) =>
            setEditingLabelId(next ? editingLabelId : null)
          }
        />
      )}

      {deletingLabelId && (
        <ConfirmDeleteDialog
          title="Delete Label"
          description={`Are you sure you want to delete "${labels.find((l) => l.id === deletingLabelId)?.name}"? It will be removed from every task on this board.`}
          onConfirm={() => deleteLabel(deletingLabelId)}
          isLoading={isDeletingLabel}
          open={!!deletingLabelId}
          onOpenChange={(next) =>
            setDeletingLabelId(next ? deletingLabelId : null)
          }
        />
      )}

      <CreateLabelDialog
        boardId={boardId}
        open={isCreating}
        onOpenChange={setIsCreating}
      />
    </>
  );
}
