import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, logoutUser } from "@/lib/api/auth.api";
import { getHttpStatus } from "@/lib/httpStatus";
import { useRecentStore } from "@/stores/recentStore";

export function useAuth() {
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch,
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
      queryClient.setQueryData(["currentUser"], null);
    },
  });

  // A 401 from /auth/me means the session is genuinely gone (invalid or
  // expired credentials). Any other failure — network error, 5xx — is a
  // transient problem: the user may still be authenticated, so report it as a
  // session-check error instead of treating them as logged out.
  const sessionCheckFailed = isError && getHttpStatus(error) !== 401;

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user && !isError,
    sessionCheckFailed,
    sessionCheckError: sessionCheckFailed ? error : null,
    retrySessionCheck: refetch,
    isError,
    error,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
  };
}
