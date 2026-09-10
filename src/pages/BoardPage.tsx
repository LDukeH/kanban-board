import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ColumnCard } from "@/components/board/ColumnCard";
import { CreateColumnDialog } from "@/components/dialog/CreateColumnDialog";
import { BoardLabelsPopover } from "@/components/board/BoardLabelsPopover";
import { useBoard } from "@/hooks/useBoard";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { describeLoadError } from "@/lib/httpStatus";
import { Loader2, ArrowLeft, Columns3, Kanban } from "lucide-react";
import {
  DragDropProvider,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  useDragOperation,
} from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { columnTasksQueryKey, useColumnTasks } from "@/hooks/useColumnTasks";
import type { Task } from "@/types/board";
import { useState, useCallback, useEffect, type WheelEvent } from "react";
import { TaskCard } from "@/components/board/TaskCard";
import { TaskFilterPopover } from "@/components/board/TaskFilterPopover";
import { useRecentStore } from "@/stores/recentStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  filterFromSearchParams,
  filterToSearchParams,
  isTaskFilterActive,
  loadBoardTaskFilter,
  saveBoardTaskFilter,
  type TaskFilter,
} from "@/lib/taskFilter";

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

function BoardDragOverlay({ boardId }: { boardId: string }) {
  const { source } = useDragOperation();
  const isTaskDrag = source?.data?.type === "task";

  return (
    <DragOverlay dropAnimation={isTaskDrag ? null : undefined}>
      <div className="pointer-events-none">
        {source?.data?.type === "column" ? (
          <div className="flex h-full w-72 shrink-0 rotate-1 flex-col rounded-xl border border-primary/40 bg-card shadow-xl">
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5">
              <span className="size-2 shrink-0 rounded-full bg-primary" />
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {String(source.data.columnName ?? "Column")}
              </h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {String(source.data.taskCount ?? 0)}
              </span>
            </div>
            <div className="flex flex-1 items-center justify-center p-3 text-xs text-muted-foreground">
              Moving column
            </div>
          </div>
        ) : source?.data?.type === "task" && source.data.task ? (
          <TaskCard
            task={source.data.task}
            boardId={boardId}
            canEdit={false}
            canDelete={false}
            index={0}
            isOverlay
          />
        ) : null}
      </div>
    </DragOverlay>
  );
}

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
      return;
    }

    break;
  }

  board.scrollLeft += e.deltaY;
}

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  // Key the inner content by boardId so switching boards fully remounts it and
  // resets board-scoped state (including the task filter / URL).
  return <BoardContent key={boardId} boardId={boardId ?? ""} />;
}

function BoardContent({ boardId }: { boardId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { workspaces } = useWorkspaces();

  const [searchParams, setSearchParams] = useSearchParams();
  const [taskFilter, setTaskFilter] = useState<TaskFilter>(() => {
    // Prefer the URL filter (shareable / deep-link), otherwise fall back to the
    // board's remembered filter so returning here restores the previous one.
    const urlFilter = filterFromSearchParams(searchParams);
    return isTaskFilterActive(urlFilter)
      ? urlFilter
      : loadBoardTaskFilter(boardId);
  });
  const [dragPointerY, setDragPointerY] = useState<number | null>(null);

  const updateTaskFilter = useCallback(
    (next: TaskFilter) => {
      setTaskFilter(next);
      saveBoardTaskFilter(boardId, next);
      const merged = new URLSearchParams(searchParams);
      // Remove all filter keys, then set the new ones (keeps unrelated params).
      ["q", "no_assignees", "assignees", "no_labels", "labels"].forEach((key) =>
        merged.delete(key),
      );
      Object.entries(filterToSearchParams(next)).forEach(([key, value]) =>
        merged.set(key, value),
      );
      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams, boardId],
  );

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

  const { updateTaskPosition } = useColumnTasks(boardId, undefined);
  const workspace = workspaces.find((w) => w.id === board?.workspaceId);

  const { recordBoard, recordWorkspace } = useRecentStore();
  const { setSelectedWorkspaceId } = useWorkspaceStore();

  // Remember this board (and its workspace) as recently accessed for the
  // sidebar. Fires once the board loads, then again once its workspace has a
  // name to record.
  useEffect(() => {
    if (!board) return;
    recordBoard({
      id: board.id,
      name: board.name,
      workspaceId: board.workspaceId,
    });
    if (workspace) {
      recordWorkspace({ id: workspace.id, name: workspace.name });
    }
    // Keep the sidebar's Boards section pointed at this board's workspace.

    setSelectedWorkspaceId(board.workspaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id, workspace?.id]);

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

  function handleDragMove(event: DragMoveEvent) {
    setDragPointerY(event.operation.position.current.y);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragPointerY(null);

    const source = event.operation.source;

    if (event.canceled) return;

    const target = event.operation.target;

    if (!source || !target) return;

    if (source.data?.type === "column" && isSortable(source)) {
      const { initialIndex, index: newIndex } = source.sortable;

      if (initialIndex === newIndex) return;

      updateColumnPosition({
        columnId: String(source.id),
        position: newIndex,
      });

      return;
    }

    if (source.data?.type === "task" && isSortable(source)) {
      const taskId = String(source.id);
      const targetId = String(target.id);
      const { initialIndex, index, group, initialGroup } = source.sortable;

      const sourceColumnId = String(
        source.data?.columnId ?? initialGroup ?? "",
      );
      const targetColumnId = String(
        target.data?.columnId ??
          target.data?.task?.columnId ??
          (isSortable(target) ? target.sortable.group : group) ??
          sourceColumnId,
      );
      const targetRect = isSortable(target)
        ? target.element?.getBoundingClientRect()
        : undefined;
      const dropBelowTarget =
        targetRect !== undefined &&
        event.operation.position.current.y >=
          targetRect.top + targetRect.height / 2;
      const rawDestinationPosition = isSortable(target)
        ? target.sortable.index + (dropBelowTarget ? 1 : 0)
        : index;
      const sourceIndexAdjustment =
        isSortable(target) &&
        sourceColumnId === targetColumnId &&
        initialIndex < rawDestinationPosition
          ? 1
          : 0;
      const destinationPosition = Number.isFinite(rawDestinationPosition)
        ? Math.max(
            0,
            Math.floor(rawDestinationPosition - sourceIndexAdjustment),
          )
        : 0;

      if (
        !sourceColumnId ||
        sourceColumnId === "undefined" ||
        !targetColumnId ||
        targetColumnId === "undefined"
      ) {
        return;
      }

      // Dropped onto empty container area
      if (target.data?.type === "task-container" && targetId !== taskId) {
        const containerColumnId = String(target.data.columnId ?? target.id);
        if (!sourceColumnId || !containerColumnId) return;

        if (!boardId) return;

        const targetTasks = (
          queryClient.getQueryData<Task[]>(
            columnTasksQueryKey(boardId, containerColumnId),
          ) ?? []
        ).filter((t) => String(t.id) !== taskId);

        const destinationPosition = targetTasks.length;

        if (
          sourceColumnId === containerColumnId &&
          initialIndex === destinationPosition
        )
          return;

        updateTaskPosition({
          taskId,
          sourceColumnId,
          columnId: containerColumnId,
          position: destinationPosition,
        });

        return;
      }

      // Normal drop on or between tasks
      const isSameColumn = sourceColumnId === targetColumnId;

      if (isSameColumn && initialIndex === destinationPosition) return;

      updateTaskPosition({
        taskId,
        sourceColumnId,
        columnId: targetColumnId,
        position: destinationPosition,
      });

      return;
    }
  }

  if (!boardId) {
    return null;
  }

  return (
    <DashboardLayout className="overflow-hidden">
      <header className="flex shrink-0 items-center justify-between bg-background px-6 py-4">
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

          <div className="flex size-10 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-600 text-white">
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

        <div className="flex items-center gap-2">
          <TaskFilterPopover
            filter={taskFilter}
            onChange={updateTaskFilter}
            boardId={boardId}
            workspaceId={board?.workspaceId}
          />

          <BoardLabelsPopover boardId={boardId} />
        </div>
      </header>

      <DragDropProvider
        onDragMove={handleDragMove}
        onDragEnd={canManageColumns || canUseTasks ? handleDragEnd : undefined}
      >
        <div
          className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-8 py-6"
          onWheel={handleBoardWheel}
        >
          {isLoadingBoard || isLoadingColumns ? (
            <BoardLoading />
          ) : isBoardError || isColumnsError ? (
            <BoardError
              message={describeLoadError(boardError ?? columnsError)}
            />
          ) : sortedColumns.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <EmptyColumns />

              {canManageColumns && <CreateColumnDialog boardId={boardId} />}
            </div>
          ) : (
            <div className="flex h-full items-stretch gap-4">
              {sortedColumns.map((column, index) => (
                <ColumnCard
                  key={column.id}
                  column={column}
                  index={index}
                  filter={taskFilter}
                  canEdit={canManageColumns}
                  canDelete={canManageColumns}
                  canCreateTask={canUseTasks}
                  canEditTask={canUseTasks}
                  canDeleteTask={canRemoveTasks}
                  dragPointerY={dragPointerY}
                />
              ))}

              {canManageColumns && (
                <div className="flex shrink-0 items-start pr-2">
                  <CreateColumnDialog boardId={boardId} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Keep the overlay outside the horizontally scrolling board. */}
        <BoardDragOverlay boardId={boardId} />
      </DragDropProvider>
    </DashboardLayout>
  );
}
