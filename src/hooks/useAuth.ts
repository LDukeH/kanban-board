import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, logoutUser } from "@/lib/api/auth.api";

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
