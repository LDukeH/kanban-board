import type { AxiosError } from "axios";

function isAxiosErrorLike(error: unknown): error is AxiosError {
  return typeof error === "object" && error !== null && "isAxiosError" in error;
}

export function getHttpStatus(error: unknown): number | undefined {
  return isAxiosErrorLike(error) ? error.response?.status : undefined;
}

/** OCC conflict (HTTP 409). The contract answers with a plain-text "conflict" body, so detect by status only. */
export function isConflictError(error: unknown): boolean {
  return getHttpStatus(error) === 409;
}

/** The row is gone (HTTP 404) — on a mutation with a version this is a stale snapshot too, so callers treat it like a conflict. */
export function isNotFoundError(error: unknown): boolean {
  return getHttpStatus(error) === 404;
}

/** Stale snapshot: version mismatch (409) or deleted row (404) → rollback + refetch. */
export function isStaleError(error: unknown): boolean {
  return isConflictError(error) || isNotFoundError(error);
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
  if (isAxiosErrorLike(error)) {
    const axiosError = error;
    const status = axiosError.response?.status;
    const body = axiosError.response?.data;
    const bodyText = extractErrorBodyText(body);
    if (status === 401) {
      // Prefer the backend message unless it is a bare "Unauthorized", which tells the user nothing.
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

/**
 * Move-specific messaging for OCC: a 409 (version moved on) or 404 (row deleted) means the
 * board changed elsewhere — the hooks already rolled back and refetched, so say that instead
 * of surfacing the backend's bare "conflict" body. Network and 5xx failures get their own copy
 * because the move was reverted locally in those cases too.
 */
function describeMoveError(
  error: unknown,
  fallback: string,
  noun: "task" | "column",
): string {
  if (isConflictError(error)) {
    return `Another session changed this ${noun} first — the board has been refreshed with the latest data. Please try the move again.`;
  }
  if (isNotFoundError(error)) {
    return `This ${noun} no longer exists — the board has been refreshed.`;
  }
  if (isAxiosErrorLike(error) && !error.response) {
    return "Could not reach the server — the move was reverted. Check your connection and try again.";
  }
  const status = getHttpStatus(error);
  if (status !== undefined && status >= 500) {
    return "The server had a problem — the move was reverted. Please try again.";
  }
  return describeMutationError(error, fallback);
}

export function describeTaskMoveError(
  error: unknown,
  fallback: string,
): string {
  return describeMoveError(error, fallback, "task");
}

export function describeColumnMoveError(
  error: unknown,
  fallback: string,
): string {
  return describeMoveError(error, fallback, "column");
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

/**
 * Supabase Auth answers with a captcha-flavored error when Bot and Abuse
 * Protection is enabled and the request carries no (or an invalid) hCaptcha
 * token. Callers use this to reveal the challenge only when it is required.
 */
export function isCaptchaError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const authError = error as { code?: unknown; message?: unknown };
  const code =
    typeof authError.code === "string" ? authError.code.toLowerCase() : "";
  const message =
    typeof authError.message === "string"
      ? authError.message.toLowerCase()
      : "";
  return message.includes("captcha") || code.includes("captcha");
}

/** On sign-in a 401/400 means bad credentials (not an expired session); on register the backend body is preferred so validation stays specific. */
export function describeAuthFormError(
  error: unknown,
  action:
    | "Sign in"
    | "Create account"
    | "Send reset email"
    | "Update password"
    | "Sign in with Google",
): string {
  const authError = error as {
    code?: unknown;
    message?: unknown;
    status?: unknown;
  };
  const code = typeof authError.code === "string" ? authError.code : "";
  const authStatus =
    typeof authError.status === "number" ? authError.status : undefined;
  const message =
    typeof authError.message === "string"
      ? authError.message.toLowerCase()
      : "";

  if (
    action === "Sign in" &&
    (code === "email_not_confirmed" || message.includes("email not confirmed"))
  ) {
    return "Please confirm your email address before signing in.";
  }
  if (message.includes("email provider is disabled")) {
    return "Email/password sign-in is disabled in Supabase Auth.";
  }
  if (
    action === "Create account" &&
    (message.includes("error sending confirmation email") ||
      message.includes("smtp") ||
      message.includes("email service") ||
      message.includes("database error saving new user"))
  ) {
    return "Supabase could not create the account because its email or database service failed. Check the Supabase Auth SMTP settings and project logs.";
  }
  if (message.includes("invalid api key") || message.includes("project ref")) {
    return "Supabase Auth is not configured correctly for this app.";
  }
  if (
    action === "Sign in with Google" &&
    (message.includes("unsupported provider") ||
      message.includes("provider is not enabled"))
  ) {
    return "Google sign-in is not enabled in Supabase. Enable Google under Authentication > Providers, then add the Google client credentials.";
  }
  if (isCaptchaError(error)) {
    return "hCaptcha verification failed. Add this host to the hCaptcha site key or complete the challenge again.";
  }
  if (
    authStatus === 429 ||
    code === "signup_rate_limited" ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return "Supabase Auth is temporarily rate-limiting requests. Wait a minute before trying again.";
  }
  const status = getHttpStatus(error);
  if (
    action === "Sign in" &&
    (status === 401 || status === 400 || authStatus === 400)
  ) {
    // Some backends answer 400 for invalid credentials; either way the body ("Unauthorized") is not helpful.
    return "Invalid email or password. Please try again.";
  }
  if (status === 409) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (isAxiosErrorLike(error) && !error.response) {
    return "Unable to connect to the server. Check your connection and try again.";
  }
  return describeMutationError(error, `Could not ${action.toLowerCase()}. Please try again.`);
}

/**
 * Single funnel for reporting a failed UI mutation to the dev console.
 * UI copy stays wherever the caller renders it (dialog/panel/banner); this
 * only keeps the console context searchable and consistent.
 */
export function reportMutationError(context: string, error: unknown): void {
  console.error(`${context}:`, error);
}
