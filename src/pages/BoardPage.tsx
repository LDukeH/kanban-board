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
import type { WheelEvent } from "react";

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

/**
 * Route vertical wheel to column task lists when they can still scroll;
 * otherwise convert vertical wheel into horizontal board scroll.
 * Keeps board horizontal scroll and column vertical scroll independent.
 */
function handleBoardWheel(e: WheelEvent<HTMLDivElement>) {
  if (e.deltaY === 0) return;

  const board = e.currentTarget;
  const path =
    typeof e.nativeEvent.composedPath === "function"
      ? e.nativeEvent.composedPath()
      : [];

  for (const node of path) {
    if (!(node instanceof HTMLElement)) continue;
    if (!node.hasAttribute("data-column-scroll")) continue;

    const { scrollTop, scrollHeight, clientHeight } = node;
    const canScrollDown = scrollTop + clientHeight < scrollHeight - 1;
    const canScrollUp = scrollTop > 1;
    const scrollingDown = e.deltaY > 0;
    const scrollingUp = e.deltaY < 0;

    if ((scrollingDown && canScrollDown) || (scrollingUp && canScrollUp)) {
      // Let the task list handle vertical scroll natively.
      return;
    }
    break;
  }

  board.scrollLeft += e.deltaY;
  e.preventDefault();
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
  const {
    canManageWorkspaceContent,
    canWorkOnTasks,
    canDeleteTask,
    isLoadingRole,
  } = useWorkspaceAccess(board?.workspaceId);
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  const canManageColumns = canManageWorkspaceContent && !isLoadingRole;
  const canUseTasks = canWorkOnTasks && !isLoadingRole;
  const canRemoveTasks = canDeleteTask && !isLoadingRole;

  function handleDragEnd(event: DragEndEvent) {
    if (event.canceled) return;

    const source = event.operation.source;
    const target = event.operation.target;

    if (!source || !target) return;
    if (!isSortable(source) || !isSortable(target)) return;

    if (source.initialIndex === source.index) return;

    updateColumnPosition({
      columnId: String(source.id),
      position: target.index,
    });
  }

  if (!boardId) {
    return null;
  }

  return (
    <DashboardLayout className="overflow-hidden">
      <header className="flex shrink-0 items-center bg-background px-6 py-4">
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

      <div
        className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-8 py-6"
        onWheel={handleBoardWheel}
      >
        {isLoadingBoard || isLoadingColumns ? (
          <BoardLoading />
        ) : isBoardError || isColumnsError ? (
          <BoardError message={describeLoadError(boardError ?? columnsError)} />
        ) : sortedColumns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <EmptyColumns />
            {canManageColumns && <CreateColumnDialog boardId={boardId} />}
          </div>
        ) : (
          <DragDropProvider
            onDragEnd={canManageColumns ? handleDragEnd : undefined}
          >
            <div className="flex h-full items-stretch gap-4">
              {sortedColumns.map((column, index) => (
                <ColumnCard
                  key={column.id}
                  column={column}
                  index={index}
                  canEdit={canManageColumns}
                  canDelete={canManageColumns}
                  canCreateTask={canUseTasks}
                  canEditTask={canUseTasks}
                  canDeleteTask={canRemoveTasks}
                />
              ))}
              {canManageColumns && (
                <div className="flex shrink-0 items-start pr-2">
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
