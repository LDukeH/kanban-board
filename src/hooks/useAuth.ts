import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, logoutUser } from "@/lib/api/auth.api";
import { getHttpStatus } from "@/lib/httpStatus";
import { useRecentStore } from "@/stores/recentStore";
import { useInvitationStore } from "@/stores/invitationStore";

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

  // Recents are persisted per account (`kanban-recent:<userId>`); re-bind on user change so one account's recents never leak into another's.
  useEffect(() => {
    useRecentStore.getState().setScope(userId ?? null);
  }, [userId]);

  // Resolved invitations are in-memory and account-agnostic, so they are dropped on the same boundary to avoid leaking across accounts on a shared browser.
  useEffect(() => {
    useInvitationStore.getState().reset();
  }, [userId]);

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.setQueryData(["currentUser"], null);
    },
  });

  // A 401 from /auth/me means the session is gone; any other failure is transient, so report a session-check error rather than logging the user out.
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
