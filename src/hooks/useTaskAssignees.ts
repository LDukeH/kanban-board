import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignUserToTask,
  getTaskAssignees,
  unassignUserFromTask,
} from "@/lib/api/task.api";
import { columnTasksQueryKey } from "@/hooks/useColumnTasks";

export function taskAssigneesQueryKey(taskId: string) {
  return ["tasks", taskId, "assignees"] as const;
}

interface UseTaskAssigneesOptions {
  /** Board that owns the task — used to invalidate the embedded task list. */
  boardId?: string;
  /** Column that owns the task — used to invalidate the embedded task list. */
  columnId?: string;
}

/**
 * Task assignee state (the users assigned to a single task) plus mutations to
 * assign/unassign them. The candidate pool of assignable members is provided
 * separately by `useWorkspaceMembers`; this hook only tracks who is currently
 * assigned to the task via `GET /tasks/{taskID}/users`.
 *
 * When `boardId`/`columnId` are provided, assigning/unassigning also
 * invalidates the column's task list so task cards (which read `task.assignees`
 * embedded in that list) stay in sync.
 */
export function useTaskAssignees(
  taskId: string | undefined,
  options?: UseTaskAssigneesOptions,
) {
  const queryClient = useQueryClient();

  const queryKey =
    taskId && taskId.length > 0
      ? taskAssigneesQueryKey(taskId)
      : (["tasks", "unknown", "assignees"] as const);

  const assigneesQuery = useQuery({
    queryKey,
    queryFn: () => getTaskAssignees(taskId!),
    enabled: !!taskId,
  });

  const invalidateAssignees = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  // The task cards read assignees from the embedded column task list, so keep
  // that list in sync whenever assignments change.
  const invalidateEmbeddedTask = () => {
    if (!options?.boardId || !options?.columnId) return;
    queryClient.invalidateQueries({
      queryKey: columnTasksQueryKey(options.boardId, options.columnId),
    });
  };

  const assignUserMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      assignUserToTask(taskId!, userId),
    onSuccess: () => {
      invalidateAssignees();
      invalidateEmbeddedTask();
    },
  });

  const unassignUserMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      unassignUserFromTask(taskId!, userId),
    onSuccess: () => {
      invalidateAssignees();
      invalidateEmbeddedTask();
    },
  });

  return {
    assignees: assigneesQuery.data ?? [],
    isLoadingAssignees: assigneesQuery.isLoading,
    isAssigneesError: assigneesQuery.isError,
    assigneesError: assigneesQuery.error,
    assignUser: assignUserMutation.mutateAsync,
    isAssigningUser: assignUserMutation.isPending,
    unassignUser: unassignUserMutation.mutateAsync,
    isUnassigningUser: unassignUserMutation.isPending,
  };
}
