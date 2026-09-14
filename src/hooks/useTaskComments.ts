import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTaskComment,
  deleteComment,
  getTaskComments,
} from "@/lib/api/comment.api";
import type { Comment } from "@/types/board";

export function taskCommentsQueryKey(taskId: string) {
  return ["tasks", taskId, "comments"] as const;
}

export function useTaskComments(
  taskId: string,
  options: { enabled?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const queryKey = taskCommentsQueryKey(taskId);

  const commentsQuery = useQuery({
    queryKey,
    queryFn: () => getTaskComments(taskId),
    enabled: options.enabled,
  });

  const createCommentMutation = useMutation({
    mutationFn: (data: { content: string }) =>
      createTaskComment(taskId, data.content),
    onSuccess: (createdComment) => {
      queryClient.setQueryData<Comment[]>(queryKey, (old) => [
        ...(old ?? []),
        createdComment,
      ]);
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: (_void, commentId) => {
      queryClient.setQueryData<Comment[]>(queryKey, (old) =>
        old ? old.filter((comment) => comment.id !== commentId) : old,
      );
    },
  });

  return {
    comments: commentsQuery.data ?? [],
    isLoadingComments: commentsQuery.isLoading,
    isCommentsError: commentsQuery.isError,
    commentsError: commentsQuery.error,
    refetchComments: commentsQuery.refetch,
    createComment: createCommentMutation.mutateAsync,
    isCreatingComment: createCommentMutation.isPending,
    deleteComment: deleteCommentMutation.mutateAsync,
    isDeletingComment: deleteCommentMutation.isPending,
  };
}
