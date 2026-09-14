import { api } from "./axios";
import type { Comment } from "@/types/board";

interface CommentApiResponse {
  id: string;
  task_id: string;
  author_id: string;
  author_email: string;
  content: string;
  created_at: string;
  updated_at: string;
}

function mapComment(raw: CommentApiResponse): Comment {
  return {
    id: raw.id,
    taskId: raw.task_id,
    authorId: raw.author_id,
    authorEmail: raw.author_email,
    content: raw.content,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export const getTaskComments = async (taskId: string): Promise<Comment[]> => {
  const response = await api.get<CommentApiResponse[]>(
    `/tasks/${taskId}/comments`,
  );
  return response.data.map(mapComment);
};

export const createTaskComment = async (
  taskId: string,
  content: string,
): Promise<Comment> => {
  const response = await api.post<CommentApiResponse>(
    `/tasks/${taskId}/comments`,
    { content },
  );
  return mapComment(response.data);
};

export const deleteComment = async (commentId: string): Promise<void> => {
  await api.delete(`/comments/${commentId}`);
};
