import type { AxiosError } from "axios";

/**
 * Returns the HTTP status code of a backend error, or undefined when the
 * error is not an HTTP response (e.g. network failure).
 */
export function getHttpStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "isAxiosError" in error) {
    return (error as AxiosError).response?.status;
  }
  return undefined;
}

/**
 * Returns a user-facing message for common backend authorization failures.
 * This is UX only; the backend remains the authority.
 */
export function describeLoadError(error: unknown): string {
  const status = getHttpStatus(error);
  switch (status) {
    case 403:
      return "You don't have access to this resource.";
    case 404:
      return "This resource doesn't exist or may have been deleted.";
    case 401:
      return "Your session has expired. Please sign in again.";
    default:
      return "Something went wrong while loading.";
  }
}

/**
 * Returns a user-facing message for a failed mutation. Backend errors are
 * plain-text `http.Error` bodies (not JSON), so prefer `response.data` when it
 * is a non-empty string. Network/server-unreachable failures get a dedicated
 * message. `fallback` is used when no backend message is available.
 */
export function describeMutationError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "isAxiosError" in error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    if (status === 401) {
      return axiosError.response?.data
        ? String(axiosError.response.data)
        : "Your session has expired. Please sign in again.";
    }
    const body = axiosError.response?.data;
    if (typeof body === "string" && body.trim().length > 0) {
      return body;
    }
    if (!axiosError.response) {
      // No HTTP response received — network / server unreachable.
      return "Could not reach the server. Check your connection and try again.";
    }
  }
  return fallback;
}
