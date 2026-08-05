// axios.ts
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
// A 401 means the session/credentials are no longer valid: clear the cached
// current user so `useAuth` reports unauthenticated and ProtectedRoute
// redirects to the login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      queryClient.setQueryData(["currentUser"], null);
      queryClient.cancelQueries({ queryKey: ["currentUser"] });
    }
    return Promise.reject(error);
  },
);
