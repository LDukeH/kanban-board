import { cn } from "@/lib/utils";
import { getBoardColor } from "@/lib/colors";
import { Link } from "react-router-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Board } from "@/types/board";
import { formatRelativeTime } from "@/lib/relativeTime";
import { EditBoardDialog } from "@/components/dialog/EditBoardDialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBoards } from "@/hooks/useBoards";
import { useState } from "react";

interface BoardCardProps {
  board: Board;
  /** Total tasks on this board, once the workspace summary has loaded. */
  taskCount?: number;
  canEdit?: boolean;
  canDelete?: boolean;
  className?: string;
}

/** Neutral board card: a small rounded-square color chip carries the board's identity (its letter on the board's own color), with the name and a footer line of available metadata. */
export function BoardCard({
  board,
  taskCount,
  canEdit = false,
  canDelete = false,
  className,
}: BoardCardProps) {
  const { deleteBoard, isDeletingBoard } = useBoards(board.workspaceId);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const showActions = canEdit || canDelete;

  return (
    <div className="relative">
      <Link
        to={`/boards/${board.id}`}
        className={cn(
          "group flex h-full flex-col rounded-card border border-border bg-card p-4 transition-shadow duration-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-control text-sm font-bold text-white"
            style={{ backgroundColor: getBoardColor(board.id) }}
            aria-hidden
          >
            {board.name.charAt(0).toUpperCase()}
          </span>
          <div className={cn("min-w-0 flex-1", showActions && "pr-8")}>
            <h3
              className="truncate text-sm font-semibold text-foreground"
              title={board.name}
            >
              {board.name}
            </h3>
            {board.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {board.description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {typeof taskCount === "number" && (
            <>
              <span className="tabular-nums">
                {taskCount} {taskCount === 1 ? "task" : "tasks"}
              </span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>Updated {formatRelativeTime(board.updatedAt)}</span>
        </div>
      </Link>

      {/* Actions dropdown — positioned absolutely outside the Link to avoid nested interactive elements (<button> inside <a> is invalid HTML) */}
      {showActions && (
        <div className="absolute right-2 top-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${board.name}`}
              className="flex size-7 cursor-pointer items-center justify-center rounded-control text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem
                  onClick={() => setEditOpen(true)}
                  className="cursor-pointer"
                >
                  <Pencil />
                  Edit board
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  {canEdit && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteOpen(true)}
                    className="cursor-pointer"
                  >
                    <Trash2 />
                    Delete board
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {canEdit && (
        <EditBoardDialog
          board={board}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {canDelete && (
        <ConfirmDeleteDialog
          title="Delete Board"
          description={`Are you sure you want to delete "${board.name}"? This will permanently delete all columns and tasks within this board.`}
          onConfirm={() => deleteBoard(board.id)}
          isLoading={isDeletingBoard}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </div>
  );
}
