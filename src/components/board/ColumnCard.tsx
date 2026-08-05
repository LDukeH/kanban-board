import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import type { Column } from "@/types/board";
import { useSortable } from "@dnd-kit/react/sortable";
import { EditColumnDialog } from "@/components/board/EditColumnDialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { useBoard } from "@/hooks/useBoard";

interface ColumnCardProps {
  column: Column;
  className?: string;
  index: number;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function ColumnCard({
  column,
  className,
  index,
  canEdit = false,
  canDelete = false,
}: ColumnCardProps) {
  const { ref, isDragging } = useSortable({ id: column.id, index });
  const { deleteColumn, isDeletingColumn } = useBoard(column.boardId);

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
        <div className="ml-auto flex items-center gap-1">
          {canEdit && <EditColumnDialog column={column} />}
          {canDelete && (
            <ConfirmDeleteDialog
              title="Delete Column"
              description={`Are you sure you want to delete "${column.name}"? This will permanently delete all tasks within this column.`}
              onConfirm={() => deleteColumn(column.id)}
              isLoading={isDeletingColumn}
              trigger={
                <Button variant="ghost" size="icon-xs">
                  <Trash2 className="size-3" />
                </Button>
              }
            />
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            0
          </span>
        </div>
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
