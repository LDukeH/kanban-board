import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { searchUsersByEmail } from "@/lib/api/users.api";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus } from "./helpers/http";
import {
  actingAs,
  clearSession,
  deleteAccounts,
  installSessionManager,
  provisionUser,
  type LiveAccount,
} from "./helpers/session";

describe("live users API", () => {
  let alice: LiveAccount;
  let bob: LiveAccount;

  beforeAll(async () => {
    installSessionManager();
    await assertBackendReachable();
    alice = await provisionUser("users-alice");
    bob = await provisionUser("users-bob");
  });

  afterAll(async () => {
    if (!alice || !bob) return; // setup aborted (backend down)
    await deleteAccounts([alice, bob]);
  });

  it("finds a user by email", async () => {
    await actingAs(alice, async () => {
      const users = await searchUsersByEmail(bob.email);
      const match = users.find((u) => u.email === bob.email);

      expect(match?.id).toBe(bob.id);
    });
  });

  it("returns an empty list for an unknown email", async () => {
    await actingAs(alice, async () => {
      const users = await searchUsersByEmail("no-such-user@example.com");
      expect(users).toEqual([]);
    });
  });

  it("requires authentication", async () => {
    clearSession();

    await expectStatus(searchUsersByEmail("nobody@example.com"), 401);
  });
});