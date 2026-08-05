import { BoardCard } from "@/components/dashboard/BoardCard";
import { cn } from "@/lib/utils";
import type { Board } from "@/types/board";

interface BoardGridProps {
  boards: Board[];
  canEdit?: boolean;
  canDelete?: boolean;
  className?: string;
}

export function BoardGrid({
  boards,
  canEdit = false,
  canDelete = false,
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
    </div>
  );
}
