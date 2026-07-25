import { BoardCard, type BoardData } from "@/components/dashboard/BoardCard";
import { cn } from "@/lib/utils";

interface BoardGridProps {
  boards: BoardData[];
  className?: string;
}

export function BoardGrid({ boards, className }: BoardGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {boards.map((board) => (
        <BoardCard key={board.id} board={board} />
      ))}
    </div>
  );
}
