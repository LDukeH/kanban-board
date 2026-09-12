import { BoardCard } from "@/components/dashboard/BoardCard";
import { CreateBoardDialog } from "@/components/dialog/CreateBoardDialog";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { Board } from "@/types/board";

interface BoardGridProps {
  boards: Board[];
  canEdit?: boolean;
  canDelete?: boolean;
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
  // With no boards, the create tile is the only grid item. A responsive
  // multi-column grid would squeeze it into the first column track —
  // and in the workspace empty state the grid sits inside a narrow
  // centered box, so the tile would render tiny and off-center. Collapse
  // to a single column so the tile renders card-sized.
  const isEmpty = boards.length === 0;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        !isEmpty && "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
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
              className="group flex h-full min-h-32 cursor-pointer flex-col overflow-hidden rounded-xl border-2 border-dashed border-border bg-card/40 text-muted-foreground transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:text-primary hover:shadow-md"
            >
              {/* Slot band — mirrors the BoardCard identity band so the
                  tile keeps the same shape and height as a real card, with
                  or without sibling cards to stretch against. */}
              <span className="flex h-16 items-center justify-center border-b-2 border-dashed border-border transition-colors group-hover:border-primary/50">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <Plus className="size-5" />
                </span>
              </span>

              <span className="flex flex-1 items-center justify-center px-4 py-5 text-center text-sm font-semibold">
                Create New Board
              </span>
            </button>
          }
        />
      )}
    </div>
  );
}
