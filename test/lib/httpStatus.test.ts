import { describe, expect, it } from "vitest";
import {
  describeAuthFormError,
  describeLoadError,
  describeMutationError,
  getHttpStatus,
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