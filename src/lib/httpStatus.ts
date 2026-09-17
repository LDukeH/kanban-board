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
    const body = axiosError.response?.data;
    const bodyText = extractErrorBodyText(body);
    if (status === 401) {
      // Prefer the backend's message when it is meaningful; a bare
      // "Unauthorized" body carries no information for the user.
      if (bodyText && bodyText.toLowerCase() !== "unauthorized") {
        return bodyText;
      }
      return "Your session has expired. Please sign in again.";
    }
    if (bodyText) {
      return bodyText;
    }
    if (!axiosError.response) {
      // No HTTP response received — network / server unreachable.
      return "Could not reach the server. Check your connection and try again.";
    }
  }
  return fallback;
}

/** Backend error bodies may be a string or a `{ message | error }` object. */
function extractErrorBodyText(body: unknown): string | undefined {
  if (typeof body === "string") {
    const trimmed = body.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof body === "object" && body !== null) {
    const record = body as Record<string, unknown>;
    for (const key of ["message", "error"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
  }
  return undefined;
}

/** Inline form error for the auth forms. On the sign-in form a 401/400 means
 * invalid credentials (the user is not authenticated yet, so it is never an
 * "expired session"). On the register form the backend body is preferred so
 * validation failures stay specific. */
export function describeAuthFormError(
  error: unknown,
  action: "Sign in" | "Create account",
): string {
  const status = getHttpStatus(error);
  if (action === "Sign in" && (status === 401 || status === 400)) {
    // Some backends answer 400 for invalid credentials; either way the
    // backend body ("Unauthorized") is not helpful, so use a fixed message.
    return "Invalid email or password. Please try again.";
  }
  if (status === 409) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "isAxiosError" in error &&
    !(error as AxiosError).response
  ) {
    return "Unable to connect to the server. Check your connection and try again.";
  }
  return describeMutationError(error, `Could not ${action.toLowerCase()}. Please try again.`);
}
