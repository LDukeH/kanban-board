import { AxiosHeaders } from "axios";
import { createClient } from "@supabase/supabase-js";
import { api } from "@/lib/api/axios";
import { getCurrentUser, deleteAccount as deleteCurrentUser, logoutUser } from "@/lib/api/auth.api";
import { supabase } from "@/lib/supabase";
import { uniqueEmail, uniquePassword } from "./uniq";

export interface LiveAccount {
  id: string;
  email: string;
  password: string;
}

const jar: { token: string } = { token: "" };
const sessions = new Map<
  string,
  { access_token: string; refresh_token: string }
>();
let activeEmail: string | undefined;
let installed = false;

function createAdminClient() {
  const url = (
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    String(import.meta.env.VITE_SUPABASE_URL ?? "")
  ).trim().replace(/^["']|["']$/g, "");
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Live auth tests require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. " +
        "The service-role key is test-runner-only and must never be exposed to frontend code.",
    );
  }
  if (
    serviceRoleKey.startsWith("sb_publishable_") ||
    serviceRoleKey.startsWith("sb_anon_") ||
    serviceRoleKey === String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "")
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is a public publishable/anon key. " +
        "Use the Supabase secret key (sb_secret_...) or legacy service_role key instead.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const admin = createAdminClient();

export async function createUserWithAdmin(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
}

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
 * Creates a fresh throwaway account through Supabase Admin API and logs it in. Returns the account so
 * the caller can switch back to it with `actingAs` / `loginAs`.
 */
export async function provisionUser(prefix: string): Promise<LiveAccount> {
  const email = uniqueEmail(prefix);
  const password = uniquePassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  await loginAs({ email, password });
  await getCurrentUser();
  return { id: data.user.id, email, password };
}

/** Switches the shared client to another account's session. */
export async function loginAs(
  account: Pick<LiveAccount, "email" | "password">,
): Promise<void> {
  const cachedSession = sessions.get(account.email);
  if (cachedSession) {
    const { error } = await supabase.auth.setSession(cachedSession);
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (error) throw error;
    if (!data.session) {
      throw new Error(`Supabase did not establish a session for ${account.email}.`);
    }
    const { error: setSessionError } = await supabase.auth.setSession(data.session);
    if (setSessionError) throw setSessionError;
    sessions.set(account.email, {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  }
  activeEmail = account.email;

  // Admin-created users do not pass through the normal frontend signup flow,
  // so explicitly create the corresponding application user record.
  await api.post("/auth/sync");
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
export async function clearSession(): Promise<void> {
  jar.token = "";
  if (activeEmail) sessions.delete(activeEmail);
  activeEmail = undefined;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Posts /auth/logout and drops the local session. */
export async function logout(): Promise<void> {
  await logoutUser();
  jar.token = "";
  if (activeEmail) sessions.delete(activeEmail);
  activeEmail = undefined;
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
  await clearSession();
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
  await clearSession();
}