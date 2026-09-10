import type { AxiosError } from "axios";

export function getHttpStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "isAxiosError" in error) {
    return (error as AxiosError).response?.status;
  }
  return undefined;
}

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

export function describeMutationError(
  error: unknown,
  fallback: string,
): string {
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
