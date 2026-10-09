import { AxiosHeaders } from "axios";
import { api } from "@/lib/api/axios";
import { getCurrentUser, deleteAccount as deleteCurrentUser, loginUser, logoutUser, registerUser } from "@/lib/api/auth.api";
import { supabase } from "@/lib/supabase";
import { uniqueEmail, uniquePassword } from "./uniq";

export interface LiveAccount {
  id: string;
  email: string;
  password: string;
}

const jar: { token: string } = { token: "" };
let installed = false;

/**
 * Real axios client + manual cookie jar. Node's axios never persists cookies
 * (no browser), so login/register responses are watched for `Set-Cookie` and
 * the captured `access_token` is replayed on every request. This means the
 * live suite exercises the real production client (withCredentials config,
 * base URL, and the 401 cache-clearing interceptor) against the real backend.
 *
 * Install once per test file. Vitest isolates module state per file, so the
 * interceptors and jar never leak between files.
 */
export function installSessionManager(): void {
  if (installed) return;
  installed = true;

  api.interceptors.request.use((config) => {
    if (!jar.token) return config;
    // Axios normalizes config.headers to an AxiosHeaders instance before
    // request interceptors run.
    (config.headers as AxiosHeaders).set("Cookie", `access_token=${jar.token}`);
    return config;
  });

  api.interceptors.response.use((response) => {
    const setCookie = (response.headers as AxiosHeaders).get("set-cookie");
    if (setCookie) {
      const joined = Array.isArray(setCookie) ? setCookie.join(", ") : String(setCookie);
      const match = joined.match(/access_token=([^;,\s]+)/);
      if (match) jar.token = match[1];
    }
    return response;
  });
}

/**
 * Registers a fresh throwaway account and logs it in. Returns the account so
 * the caller can switch back to it with `actingAs` / `loginAs`.
 */
export async function provisionUser(prefix: string): Promise<LiveAccount> {
  const email = uniqueEmail(prefix);
  const password = uniquePassword();
  await registerUser({ email, password, confirmPassword: password });
  await loginUser({ email, password });
  const user = await getCurrentUser();
  return { id: user.id, email, password };
}

/** Switches the shared client to another account's session. */
export async function loginAs(account: Pick<LiveAccount, "email" | "password">): Promise<void> {
  await loginUser({ email: account.email, password: account.password });
}

/** Runs an action while authenticated as a specific account. */
export async function actingAs<T>(
  account: Pick<LiveAccount, "email" | "password">,
  action: () => Promise<T>,
): Promise<T> {
  await loginAs(account);
  return action();
}

/** Drops the local session (unauthenticated state, as after a fresh boot). */
export function clearSession(): void {
  jar.token = "";
  void supabase.auth.signOut();
}

/** Posts /auth/logout and drops the local session. */
export async function logout(): Promise<void> {
  await logoutUser();
  jar.token = "";
}

/**
 * Deletes a provisioned account (`DELETE /auth/me`) and drops the local session.
 *
 * Takes credentials rather than a `LiveAccount` handle because deletion needs
 * that account's own session, and the shared client may be logged in as someone
 * else by then.
 *
 * Cascade behaviour on the live backend: every table referencing `users(id)` is
 * `ON DELETE CASCADE` (`workspace_memberships`, `task_assignees`,
 * `notifications`, `comments`, `workspace_invitations`), so the account leaves
 * no user-owned residue — this is what removes the notification rows a live
 * test would otherwise strand. Workspaces do NOT cascade: ownership lives in
 * `workspace_memberships` and migration 012 (transfer ownership on delete) is
 * unimplemented, so a workspace whose owner is deleted survives ownerless.
 * **Delete the workspace first**, then the users.
 */
export async function deleteAccount(
  account: Pick<LiveAccount, "email" | "password">,
): Promise<void> {
  await loginAs(account);
  await deleteCurrentUser();
  clearSession();
}

/**
 * Best-effort teardown for every account a live test provisioned.
 *
 * Deletes in reverse order and never throws: a cleanup failure must not turn a
 * passing suite red, but it is still surfaced so residue is not silently
 * accepted. Entries that are not yet provisioned (setup aborted) are skipped by
 * the caller's guard.
 */
export async function deleteAccounts(
  accounts: readonly (Pick<LiveAccount, "email" | "password"> | undefined)[],
): Promise<void> {
  for (const account of [...accounts].reverse()) {
    if (!account) continue;
    try {
      await deleteAccount(account);
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response
        ?.status;
      console.warn(
        `Live fixture: could not delete test account ${account.email} (${status ?? (error as Error).message}); the dev database keeps this row.`,
      );
    }
  }
  clearSession();
}