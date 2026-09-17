import { beforeAll, describe, expect, it } from "vitest";
import { getCurrentUser, loginUser, registerUser } from "@/lib/api/auth.api";
import { queryClient } from "@/lib/queryClient";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus, UUID_RE } from "./helpers/http";
import { clearSession, installSessionManager, logout, provisionUser } from "./helpers/session";
import { uniqueEmail, uniquePassword } from "./helpers/uniq";

describe("live auth API (cookie session)", () => {
  beforeAll(async () => {
    installSessionManager();
    await assertBackendReachable();
  });

  it("registers a fresh user and reads the mapped current user", async () => {
    const account = await provisionUser("auth");

    expect(account.id).toMatch(UUID_RE);
    expect(account.email).toContain("@example.com");

    const user = await getCurrentUser();
    expect(user.id).toBe(account.id);
    expect(user.email).toBe(account.email);
    expect(user.passwordHash).toEqual(expect.any(String));
  });

  it("rejects a wrong password with 401", async () => {
    const account = await provisionUser("auth-wrong-password");

    await expectStatus(loginUser({ email: account.email, password: uniquePassword() }), 401);
  });

  it("answers 401 when no session is present", async () => {
    clearSession();

    await expectStatus(getCurrentUser(), 401);
  });

  it("invalidates the session after logout", async () => {
    const account = await provisionUser("auth-logout");
    expect((await getCurrentUser()).id).toBe(account.id);

    await logout();

    await expectStatus(getCurrentUser(), 401);
  });

  it("clears the cached current user when the API answers 401", async () => {
    await provisionUser("auth-cache");
    queryClient.setQueryData<{ id: string }>(["currentUser"], { id: "cached" });

    clearSession();
    await getCurrentUser().catch(() => undefined);

    expect(queryClient.getQueryData(["currentUser"])).toBeNull();
  });

  it("rejects a duplicate registration", async () => {
    const email = uniqueEmail("auth-duplicate");
    const password = uniquePassword();
    await registerUser({ email, password, confirmPassword: password });

    try {
      await registerUser({ email, password, confirmPassword: password });
      expect.unreachable("a duplicate registration should have been rejected");
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      // Conflict is the documented class; some routes answer 400 for duplicates.
      expect([400, 409]).toContain(status);
    }
  });
});