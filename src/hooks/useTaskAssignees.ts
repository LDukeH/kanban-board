import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignUserToTask,
  getTaskAssignees,
  unassignUserFromTask,
} from "@/lib/api/task.api";

export function taskAssigneesQueryKey(taskId: string) {
  return ["tasks", taskId, "assignees"] as const;
}

/**
 * Task assignee state (the users assigned to a single task) plus mutations to
 * assign/unassign them. The candidate pool of assignable members is provided
 * separately by `useWorkspaceMembers`; this hook only tracks who is currently
 * assigned to the task via `GET /tasks/{taskID}/users`.
 */
export function useTaskAssignees(taskId: string | undefined) {
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

  const assignUserMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      assignUserToTask(taskId!, userId),
    onSuccess: invalidateAssignees,
  });

  const unassignUserMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      unassignUserFromTask(taskId!, userId),
    onSuccess: invalidateAssignees,
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
