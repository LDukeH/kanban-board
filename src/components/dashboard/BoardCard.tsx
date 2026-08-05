import { cn } from "@/lib/utils";
import { getGradient } from "@/lib/colors";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import type { Board } from "@/types/board";
import { EditBoardDialog } from "@/components/workspace/EditBoardDialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { useBoards } from "@/hooks/useBoards";

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

  return (
    <div className="relative">
      <Link
        to={`/boards/${board.id}`}
        className={cn(
          "group relative block overflow-hidden rounded-xl bg-gradient-to-br shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
          gradient,
          className,
        )}
      >
        {/* Decorative top area */}
        <div className="h-24" />

        {/* Footer with board name */}
        <div className="bg-black/25 px-4 py-3 backdrop-blur-sm">
          <h3 className="truncate text-sm font-semibold text-white">
            {board.name}
          </h3>
          {board.description && (
            <p className="mt-0.5 line-clamp-1 text-xs text-white/80">
              {board.description}
            </p>
          )}
        </div>
      </Link>

      {/* Action buttons — positioned absolutely outside the Link to avoid
          nested interactive elements (<button> inside <a> is invalid HTML) */}
      {(canEdit || canDelete) && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
          {canEdit && <EditBoardDialog board={board} />}
          {canDelete && (
            <ConfirmDeleteDialog
              title="Delete Board"
              description={`Are you sure you want to delete "${board.name}"? This will permanently delete all columns and tasks within this board.`}
              onConfirm={() => deleteBoard(board.id)}
              isLoading={isDeletingBoard}
              trigger={
                <Button variant="ghost" size="icon-xs" className="text-white">
                  <Trash2 className="size-3" />
                </Button>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
