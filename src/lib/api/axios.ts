import axios from "axios";
import { queryClient } from "@/lib/queryClient";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Handle backend authorization failures gracefully.
// A 401 from the session check (`GET /auth/me`) means the session/credentials
// are no longer valid: clear the cached current user so `useAuth` reports
// unauthenticated and ProtectedRoute redirects to the auth page. 401s from
// the login/register endpoints are failed attempts, not session loss — leave
// the cache alone so an in-flight session check is not cancelled.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = String(error.config?.url ?? "");
    const isSessionCheck = url.includes("/auth/me");
    if (status === 401 && isSessionCheck) {
      queryClient.setQueryData(["currentUser"], null);
      queryClient.cancelQueries({ queryKey: ["currentUser"] });
    }
    return Promise.reject(error);
  },
);
