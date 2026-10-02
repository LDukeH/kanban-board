import { useQueries } from "@tanstack/react-query";
import { useBoard } from "@/hooks/useBoard";
import {
  columnTasksQueryFn,
  columnTasksQueryKey,
} from "@/hooks/useColumnTasks";
import { computeTaskSummary, type TaskSummary } from "@/lib/summary";

/**
 * Client-derived progress/workload summary for one board (Feature 5).
 *
 * Subscribes to the very same per-column task queries the board page already
 * runs, so it adds no extra requests and updates live as tasks are created,
 * moved or completed. Because there is no aggregate endpoint, every number is a
 * roll-up of data the client has already loaded and must be labelled as such.
 */
export function useBoardSummary(boardId: string | undefined) {
  const {
    columns,
    isLoadingColumns,
    isColumnsError,
    columnsError,
    refetchColumns,
  } = useBoard(boardId);

  const taskQueries = useQueries({
    queries: columns.map((column) => ({
      queryKey: columnTasksQueryKey(boardId!, column.id),
      queryFn: columnTasksQueryFn(boardId, column.id),
      enabled: !!boardId,
    })),
  });

  const taskErrors = taskQueries
    .map((query) => query.error)
    .filter((error): error is Error => error != null);

  const isLoading =
    isLoadingColumns || taskQueries.some((query) => query.isLoading);
  const isError =
    isColumnsError || taskQueries.some((query) => query.isError);
  const error = columnsError ?? taskErrors[0];

  const tasks = taskQueries.flatMap((query) => query.data ?? []);
  const summary: TaskSummary | undefined = isLoading
    ? undefined
    : computeTaskSummary(tasks, columns);

  return {
    summary,
    isLoadingSummary: isLoading,
    isSummaryError: isError,
    summaryError: error,
    refetchSummary: () => {
      void refetchColumns();
      for (const query of taskQueries) void query.refetch();
    },
  };
}
