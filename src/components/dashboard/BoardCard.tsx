import { cn } from "@/lib/utils";
import { getGradient } from "@/lib/colors";
import { Link } from "react-router-dom";
import type { Board } from "@/types/board";

interface BoardCardProps {
  board: Board;
  className?: string;
}

export function BoardCard({ board, className }: BoardCardProps) {
  const gradient = getGradient(board.id);

  return (
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
  );
}
