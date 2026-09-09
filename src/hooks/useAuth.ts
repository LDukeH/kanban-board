import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, logoutUser } from "@/lib/api/auth.api";
import { useRecentStore } from "@/stores/recentStore";

export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

  const userId = user?.id;

  // Recents are persisted per account (`kanban-recent:<userId>`). Re-bind the
  // store whenever the signed-in user changes (login, logout, session restore,
  // 401) so one account's recently visited workspaces/boards never leak into
  // another account's sidebar.
  useEffect(() => {
    useRecentStore.getState().setScope(userId ?? null);
  }, [userId]);

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      // Clear the user from query cache on logout
      queryClient.setQueryData(["currentUser"], null);
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user && !isError,
    logout: logoutMutation.mutateAsync,
  };
}
