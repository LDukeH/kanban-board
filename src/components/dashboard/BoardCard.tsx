import { cn } from "@/lib/utils";
import { getGradient } from "@/lib/colors";
import type { Board } from "@/types/board";

interface BoardCardProps {
  board: Board;
  className?: string;
}

export function BoardCard({ board, className }: BoardCardProps) {
  const gradient = getGradient(board.id);

  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl bg-gradient-to-br shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
        gradient,
        className,
      )}
    >
      {/* Decorative top area */}
      <div className="flex h-24 items-start justify-end p-3">
        <span className="rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          Board
        </span>
      </div>

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
    </div>
  );
}
