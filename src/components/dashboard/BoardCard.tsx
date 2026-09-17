import { cn } from "@/lib/utils";
import { getGradient } from "@/lib/colors";
import { Link } from "react-router-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Board } from "@/types/board";
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
  canEdit?: boolean;
  canDelete?: boolean;
  className?: string;
}

export function BoardCard({
  board,
  canEdit = false,
  canDelete = false,
  className,
}: BoardCardProps) {
  const gradient = getGradient(board.id);
  const { deleteBoard, isDeletingBoard } = useBoards(board.workspaceId);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const showActions = canEdit || canDelete;

  return (
    <div className="relative">
      <Link
        to={`/boards/${board.id}`}
        className={cn(
          "group block overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md",
          className,
        )}
      >
        {/* Identity band — a slim gradient strip keeps per-board color identity
            without the old two-tone color blocking. */}
        <div
          className={cn(
            "flex h-16 items-center bg-linear-to-br px-4",
            gradient,
          )}
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/25 text-base font-bold text-white backdrop-blur-sm">
            {board.name.charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="px-4 py-5">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {board.name}
          </h3>
          {board.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {board.description}
            </p>
          )}
        </div>
      </Link>

      {/* Actions dropdown — positioned absolutely outside the Link to avoid
          nested interactive elements (<button> inside <a> is invalid HTML) */}
      {showActions && (
        <div className="absolute right-2 top-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${board.name}`}
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-black/20 text-white transition-colors hover:bg-black/30"
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
          successMessage={`Board “${board.name}” deleted`}
          onConfirm={() => deleteBoard(board.id)}
          isLoading={isDeletingBoard}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </div>
  );
}
