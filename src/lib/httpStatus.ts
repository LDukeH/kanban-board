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
