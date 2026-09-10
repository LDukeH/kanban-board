import { BoardCard } from "@/components/dashboard/BoardCard";
import { CreateBoardDialog } from "@/components/dialog/CreateBoardDialog";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { Board } from "@/types/board";

interface BoardGridProps {
  boards: Board[];
  canEdit?: boolean;
  canDelete?: boolean;
  /** When set (with `canCreate`), a dashed "Create New Board" tile is appended. */
  workspaceId?: string;
  canCreate?: boolean;
  className?: string;
}

export function BoardGrid({
  boards,
  canEdit = false,
  canDelete = false,
  workspaceId,
  canCreate = false,
  className,
}: BoardGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {boards.map((board) => (
        <BoardCard
          key={board.id}
          board={board}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      ))}

      {workspaceId && canCreate && (
        <CreateBoardDialog
          workspaceId={workspaceId}
          trigger={
            <button
              type="button"
              className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card/40 text-muted-foreground transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:text-primary hover:shadow-md"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Plus className="size-6" />
              </span>
              <span className="text-sm font-semibold">Create New Board</span>
            </button>
          }
        />
      )}
    </div>
  );
}
