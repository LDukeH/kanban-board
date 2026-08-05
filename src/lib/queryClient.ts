import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient singleton.
 * Exposed so the axios interceptor can clear the `currentUser` cache
 * on a 401 Unauthorized response.
 */
export const queryClient = new QueryClient();
