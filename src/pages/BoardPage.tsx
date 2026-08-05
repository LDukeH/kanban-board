import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ColumnCard } from "@/components/board/ColumnCard";
import { CreateColumnDialog } from "@/components/board/CreateColumnDialog";
import { useBoard } from "@/hooks/useBoard";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { describeLoadError } from "@/lib/httpStatus";
import { Loader2, ArrowLeft, Columns3, Kanban } from "lucide-react";
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";

function BoardLoading() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}

function BoardError({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}

function EmptyColumns() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Columns3 className="size-6" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">
          No columns yet
        </h2>
        <p className="text-sm text-muted-foreground">
          Create your first column to start organizing tasks.
        </p>
      </div>
    </div>
  );
}

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { workspaces } = useWorkspaces();
  const {
    board,
    isLoadingBoard,
    isBoardError,
    boardError,
    columns,
    isLoadingColumns,
    isColumnsError,
    columnsError,
    updateColumnPosition,
  } = useBoard(boardId);

  const workspace = workspaces.find((w) => w.id === board?.workspaceId);
  const { canManageWorkspaceContent, isLoadingRole } = useWorkspaceAccess(
    board?.workspaceId,
  );
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled) return;
    console.log("Drag ended:", event);

    const source = event.operation.source;
    const target = event.operation.target;

    if (!source || !target) return;
    if (!isSortable(source) || !isSortable(target)) return;

    if (source.initialIndex === source.index) return;

    console.log(
      `Moving column ${source.id} from index ${source.initialIndex} to index ${target.index}`,
    );

    updateColumnPosition({
      columnId: String(source.id),
      position: target.index,
    });
  }

  if (!boardId) {
    return null;
  }

  return (
    <DashboardLayout>
      <header className="flex items-center bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              navigate(
                board?.workspaceId
                  ? `/workspaces/${board.workspaceId}`
                  : "/workspaces",
              )
            }
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Back to workspace"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
            <Kanban className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {isLoadingBoard ? "Loading..." : (board?.name ?? "Board")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLoadingBoard
                ? "Loading..."
                : (board?.description ?? workspace?.name ?? "Board workspace")}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-x-auto px-8 py-6">
        {isLoadingBoard || isLoadingColumns ? (
          <BoardLoading />
        ) : isBoardError || isColumnsError ? (
          <BoardError message={describeLoadError(boardError ?? columnsError)} />
        ) : sortedColumns.length === 0 ? (
          <div className="flex flex-col items-center gap-4">
            <EmptyColumns />
            {canManageWorkspaceContent && !isLoadingRole && (
              <CreateColumnDialog boardId={boardId} />
            )}
          </div>
        ) : (
          <DragDropProvider
            onDragEnd={canManageWorkspaceContent ? handleDragEnd : undefined}
          >
            <div className="flex h-full items-start gap-4">
              {sortedColumns.map((column, index) => (
                <ColumnCard key={column.id} column={column} index={index} />
              ))}
              {canManageWorkspaceContent && !isLoadingRole && (
                <div className="pr-2">
                  <CreateColumnDialog boardId={boardId} />
                </div>
              )}
            </div>
          </DragDropProvider>
        )}
      </div>
    </DashboardLayout>
  );
}
