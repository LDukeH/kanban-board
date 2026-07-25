import { cn } from "@/lib/utils";
import { Calendar, ListTodo } from "lucide-react";

export interface BoardData {
  id: string;
  name: string;
  description: string;
  taskCount: number;
  lastModified: string;
  color: string;
}

interface BoardCardProps {
  board: BoardData;
  className?: string;
}

export function BoardCard({ board, className }: BoardCardProps) {
  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30",
        className,
      )}
    >
      {/* Color accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: board.color }}
      />

      <div className="mt-1 space-y-3">
        {/* Board Name */}
        <h3 className="text-base font-semibold text-card-foreground">
          {board.name}
        </h3>

        {/* Description */}
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {board.description}
        </p>

        {/* Meta Info */}
        <div className="flex items-center gap-4 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ListTodo className="size-3.5" />
            <span>{board.taskCount} tasks</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5" />
            <span>{board.lastModified}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
