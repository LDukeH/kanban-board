import { describe, expect, it, vi } from "vitest";
import {
  describeAuthFormError,
  describeColumnMoveError,
  describeLoadError,
  describeMutationError,
  describeTaskMoveError,
  getHttpStatus,
  isCaptchaError,
  isConflictError,
  isNotFoundError,
  isStaleError,
  reportMutationError,
} from "@/lib/httpStatus";

describe("getHttpStatus", () => {
  it("returns the response status for axios errors", () => {
    const error = { isAxiosError: true, response: { status: 403 } };
    expect(getHttpStatus(error)).toBe(403);
  });

  it("returns undefined when there is no response", () => {
    expect(getHttpStatus({ isAxiosError: true })).toBeUndefined();
  });

  it("returns undefined for non-axios errors", () => {
    expect(getHttpStatus(new Error("boom"))).toBeUndefined();
    expect(getHttpStatus(null)).toBeUndefined();
  });
});

describe("describeLoadError", () => {
  const axiosError = (status: number) => ({ isAxiosError: true, response: { status } });

  it("describes 403 as an access problem", () => {
    expect(describeLoadError(axiosError(403))).toBe("You don't have access to this resource.");
  });

  it("describes 404 as a missing resource", () => {
    expect(describeLoadError(axiosError(404))).toBe(
      "This resource doesn't exist or may have been deleted.",
    );
  });

  it("describes 401 as an expired session", () => {
    expect(describeLoadError(axiosError(401))).toBe(
      "Your session has expired. Please sign in again.",
    );
  });

  it("falls back to a generic message otherwise", () => {
    expect(describeLoadError(axiosError(500))).toBe("Something went wrong while loading.");
    expect(describeLoadError(new Error("boom"))).toBe("Something went wrong while loading.");
  });
});

describe("describeMutationError", () => {
  it("prefers the 401 response data when present", () => {
    const error = { isAxiosError: true, response: { status: 401, data: "Session invalid" } };
    expect(describeMutationError(error, "fallback")).toBe("Session invalid");
  });

  it("uses the session-expired message for a 401 without data", () => {
    const error = { isAxiosError: true, response: { status: 401, data: undefined } };
    expect(describeMutationError(error, "fallback")).toBe(
      "Your session has expired. Please sign in again.",
    );
  });

  it("returns the response body for string error bodies", () => {
    const error = { isAxiosError: true, response: { status: 400, data: "Title too long" } };
    expect(describeMutationError(error, "fallback")).toBe("Title too long");
  });

  it("detects network failures that never reached the server", () => {
    const error = { isAxiosError: true, response: undefined, status: "ERR_NETWORK" };
    expect(describeMutationError(error, "fallback")).toBe(
      "Could not reach the server. Check your connection and try again.",
    );
  });

  it("falls back for non-axios errors", () => {
    expect(describeMutationError(new Error("boom"), "fallback")).toBe("fallback");
  });

  it("treats a bare Unauthorized 401 body as an expired session", () => {
    const error = { isAxiosError: true, response: { status: 401, data: "Unauthorized" } };
    expect(describeMutationError(error, "fallback")).toBe(
      "Your session has expired. Please sign in again.",
    );
  });

  it("reads message/error fields from object error bodies", () => {
    expect(
      describeMutationError(
        { isAxiosError: true, response: { status: 400, data: { message: "Title too long" } } },
        "fallback",
      ),
    ).toBe("Title too long");
    expect(
      describeMutationError(
        { isAxiosError: true, response: { status: 400, data: { error: "Bad input" } } },
        "fallback",
      ),
    ).toBe("Bad input");
  });
});

describe("describeAuthFormError", () => {
  it("maps sign-in 401/400 to invalid credentials", () => {
    expect(
      describeAuthFormError(
        { isAxiosError: true, response: { status: 401, data: "Unauthorized" } },
        "Sign in",
      ),
    ).toBe("Invalid email or password. Please try again.");
    expect(
      describeAuthFormError(
        { isAxiosError: true, response: { status: 400, data: "Unauthorized" } },
        "Sign in",
      ),
    ).toBe("Invalid email or password. Please try again.");
  });

  it("maps a Supabase 400 sign-in error to invalid credentials", () => {
    expect(
      describeAuthFormError(
        { status: 400, message: "Invalid login credentials" },
        "Sign in",
      ),
    ).toBe("Invalid email or password. Please try again.");
  });

  it("reports captcha verification failures separately", () => {
    expect(
      describeAuthFormError(
        {
          status: 400,
          code: "captcha_failed",
          message: "Captcha verification failed",
        },
        "Sign in",
      ),
    ).toBe(
      "hCaptcha verification failed. Add this host to the hCaptcha site key or complete the challenge again.",
    );
  });

  it("maps 409 to an existing-account message", () => {
    expect(
      describeAuthFormError(
        { isAxiosError: true, response: { status: 409, data: "Conflict" } },
        "Create account",
      ),
    ).toBe("An account with this email already exists. Try signing in instead.");
  });

  it("maps network failures to a connection message", () => {
    expect(
      describeAuthFormError(
        { isAxiosError: true, response: undefined },
        "Sign in",
      ),
    ).toBe("Unable to connect to the server. Check your connection and try again.");
  });

  it("prefers the backend body on the register form", () => {
    expect(
      describeAuthFormError(
        { isAxiosError: true, response: { status: 400, data: "Email already taken" } },
        "Create account",
      ),
    ).toBe("Email already taken");
  });
});

describe("isCaptchaError", () => {
  it("flags captcha failures by message or code, case-insensitively", () => {
    expect(isCaptchaError({ message: "Captcha verification failed" })).toBe(true);
    expect(isCaptchaError({ message: "hCaptcha required" })).toBe(true);
    expect(isCaptchaError({ code: "CAPTCHA_FAILED", message: "boom" })).toBe(true);
  });

  it("does not flag unrelated auth errors", () => {
    expect(isCaptchaError({ message: "Invalid login credentials" })).toBe(false);
    expect(isCaptchaError(new Error("boom"))).toBe(false);
    expect(isCaptchaError(null)).toBe(false);
  });
});

describe("isConflictError / isNotFoundError / isStaleError", () => {
  it("flags 409 as a conflict and a stale snapshot", () => {
    const error = { isAxiosError: true, response: { status: 409, data: "conflict" } };
    expect(isConflictError(error)).toBe(true);
    expect(isNotFoundError(error)).toBe(false);
    expect(isStaleError(error)).toBe(true);
  });

  it("flags 404 as a stale snapshot (row deleted elsewhere)", () => {
    const error = { isAxiosError: true, response: { status: 404 } };
    expect(isConflictError(error)).toBe(false);
    expect(isNotFoundError(error)).toBe(true);
    expect(isStaleError(error)).toBe(true);
  });

  it("does not flag other statuses or missing responses", () => {
    expect(isStaleError({ isAxiosError: true, response: { status: 500 } })).toBe(false);
    expect(isStaleError({ isAxiosError: true, response: { status: 400 } })).toBe(false);
    expect(isStaleError({ isAxiosError: true })).toBe(false);
    expect(isStaleError(new Error("boom"))).toBe(false);
  });
});

describe("describeTaskMoveError / describeColumnMoveError", () => {
  const conflict = { isAxiosError: true, response: { status: 409, data: "conflict" } };

  it("explains a 409 without leaking the bare backend conflict body", () => {
    expect(describeTaskMoveError(conflict, "fallback")).toBe(
      "Another session changed this task first — the board has been refreshed with the latest data. Please try the move again.",
    );
    expect(describeColumnMoveError(conflict, "fallback")).toBe(
      "Another session changed this column first — the board has been refreshed with the latest data. Please try the move again.",
    );
  });

  it("explains a 404 as a deleted row", () => {
    expect(
      describeTaskMoveError({ isAxiosError: true, response: { status: 404 } }, "fallback"),
    ).toBe("This task no longer exists — the board has been refreshed.");
    expect(
      describeColumnMoveError({ isAxiosError: true, response: { status: 404 } }, "fallback"),
    ).toBe("This column no longer exists — the board has been refreshed.");
  });

  it("explains network failures as a reverted move", () => {
    expect(describeTaskMoveError({ isAxiosError: true }, "fallback")).toBe(
      "Could not reach the server — the move was reverted. Check your connection and try again.",
    );
  });

  it("explains 5xx failures as a reverted move", () => {
    expect(
      describeColumnMoveError({ isAxiosError: true, response: { status: 503 } }, "fallback"),
    ).toBe("The server had a problem — the move was reverted. Please try again.");
  });

  it("delegates to describeMutationError for anything else", () => {
    expect(describeTaskMoveError(new Error("boom"), "fallback")).toBe("fallback");
    expect(
      describeColumnMoveError(
        { isAxiosError: true, response: { status: 403, data: "no access" } },
        "fallback",
      ),
    ).toBe("no access");
  });
});

describe("reportMutationError", () => {
  it("logs the context together with the original error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const failure = new Error("boom");
      reportMutationError("Update task failed", failure);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith("Update task failed:", failure);
    } finally {
      spy.mockRestore();
    }
  });
});