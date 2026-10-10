import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getCurrentUser } from "@/lib/api/auth.api";
import { queryClient } from "@/lib/queryClient";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus, UUID_RE } from "./helpers/http";
import {
  clearSession,
  createUserWithAdmin,
  deleteAccounts,
  installSessionManager,
  logout,
  provisionUser,
  type LiveAccount,
} from "./helpers/session";
import { uniquePassword } from "./helpers/uniq";

describe("live auth API (cookie session)", () => {
  // Each test provisions its own throwaway account; they are collected here and
  // deleted in `afterAll` so the dev database keeps nothing from this run.
  const accounts: LiveAccount[] = [];

  async function provision(prefix: string): Promise<LiveAccount> {
    const account = await provisionUser(prefix);
    accounts.push(account);
    return account;
  }

  beforeAll(async () => {
    installSessionManager();
    await assertBackendReachable();
  });

  afterAll(async () => {
    await deleteAccounts(accounts);
  });

  it("creates a fresh user and reads the mapped current user", async () => {
    const account = await provision("auth");

    expect(account.id).toMatch(UUID_RE);
    expect(account.email).toContain("@example.com");

    const user = await getCurrentUser();
    expect(user.id).toBe(account.id);
    expect(user.email).toBe(account.email);
  });

  it("rejects an unauthenticated request with 401", async () => {
    await provision("auth-wrong-password");

    await clearSession();
    await expectStatus(getCurrentUser(), 401);
  });

  it("answers 401 when no session is present", async () => {
    await clearSession();

    await expectStatus(getCurrentUser(), 401);
  });

  it("invalidates the session after logout", async () => {
    const account = await provision("auth-logout");
    expect((await getCurrentUser()).id).toBe(account.id);

    await logout();

    await expectStatus(getCurrentUser(), 401);
  });

  it("clears the cached current user when the API answers 401", async () => {
    await provision("auth-cache");
    queryClient.setQueryData<{ id: string }>(["currentUser"], { id: "cached" });

    await clearSession();
    await getCurrentUser().catch(() => undefined);

    expect(queryClient.getQueryData(["currentUser"])).toBeNull();
  });

  it("rejects duplicate user creation", async () => {
    const password = uniquePassword();
    const account = await provision("auth-duplicate");
    await expect(
      createUserWithAdmin(account.email, password),
    ).rejects.toBeTruthy();
  });
});