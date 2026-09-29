import axios from "axios";
import { queryClient } from "@/lib/queryClient";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// A 401 from the session check means the credentials are gone, so clear the cached user; 401s from login/register are failed attempts, not session loss.
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
