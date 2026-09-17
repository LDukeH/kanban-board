import { api } from "@/lib/api/axios";

/**
 * Base URL for the live backend. Prefer LIVE_API_BASE_URL (per-run override),
 * fall back to what the production client was built with (VITE_API_URL), and
 * default to the documented dev address.
 */
export function liveBaseUrl(): string {
  return (
    process.env.LIVE_API_BASE_URL ?? String(import.meta.env.VITE_API_URL || "http://localhost:3000")
  );
}

/**
 * Points the shared production client at the live backend and verifies a
 * request can actually reach it. `/auth/me` answering 401 (unauthenticated) is
 * enough proof the server is up; a network failure aborts the whole suite with
 * an actionable message instead of failing every individual test obscurely.
 */
export async function assertBackendReachable(): Promise<void> {
  api.defaults.baseURL = liveBaseUrl();
  try {
    await api.get("/auth/me");
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 401) return;
    throw new Error(
      `Live-API suite: backend not reachable at ${liveBaseUrl()}. ` +
        `Start the Go Kanban API or point LIVE_API_BASE_URL at it. (${(error as Error).message})`,
      { cause: error },
    );
  }
}