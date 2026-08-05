import { cn } from "@/lib/utils";
import type { Column } from "@/types/board";
import { useSortable } from "@dnd-kit/react/sortable";

interface ColumnCardProps {
  column: Column;
  className?: string;
  index: number;
}

export function ColumnCard({ column, className, index }: ColumnCardProps) {
  const { ref, isDragging } = useSortable({ id: column.id, index });

  return (
    <div
      ref={ref}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-card",
        className,
        isDragging && "opacity-50",
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="size-2 shrink-0 rounded-full bg-primary" />
        <h3 className="truncate text-sm font-semibold text-foreground">
          {column.name}
        </h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          0
        </span>
      </div>

      {/* Task area placeholder */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No tasks yet
        </p>
      </div>
    </div>
  );
}
