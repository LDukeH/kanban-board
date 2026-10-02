import { useQuery } from "@tanstack/react-query";
import {
  collectWorkspaceBoardTasks,
  computeTaskSummary,
  mergeTaskSummaries,
  type TaskSummary,
} from "@/lib/summary";
import type { Board } from "@/types/board";

export interface WorkspaceBoardSummary {
  board: Board;
  summary: TaskSummary;
}

export interface WorkspaceSummary {
  totals: TaskSummary;
  boards: WorkspaceBoardSummary[];
}

export function workspaceSummaryQueryKey(workspaceId: string) {
  return ["workspaces", workspaceId, "task-summary"] as const;
}

/**
 * Client-derived workspace progress/workload summary (Feature 5).
 *
 * Enumerates boards -> columns -> tasks, the same cascade
 * `findBoardIdForTask` uses, because the backend exposes no aggregate
 * endpoint. Every task counted belongs to a board in this workspace, so the
 * summary cannot leak another workspace's data.
 *
 * The query has the default staleTime, so it re-reads whenever the workspace
 * page is (re)visited after edits elsewhere.
 */
export function useWorkspaceSummary(workspaceId: string | undefined) {
  const query = useQuery({
    queryKey: workspaceSummaryQueryKey(workspaceId ?? ""),
    queryFn: async (): Promise<WorkspaceSummary> => {
      const collected = await collectWorkspaceBoardTasks(workspaceId!);
      const boards = collected.map(({ board, columns, tasks }) => ({
        board,
        summary: computeTaskSummary(tasks, columns),
      }));

      return {
        totals: mergeTaskSummaries(boards.map((entry) => entry.summary)),
        boards,
      };
    },
    enabled: !!workspaceId,
  });

  return {
    summary: query.data,
    isLoadingSummary: query.isLoading,
    isSummaryError: query.isError,
    summaryError: query.error,
    refetchSummary: () => void query.refetch(),
  };
}
