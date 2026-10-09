import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/axios";
import { deleteAccount, getCurrentUser, loginUser, logoutUser, registerUser } from "@/lib/api/auth.api";
import { queryClient } from "@/lib/queryClient";
import { createMockApiAdapter, noContentRoute, route, type MockApiHandle } from "../../helpers/mockApiModule";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: authMocks,
  },
}));

const userPayload = {
  id: "u1",
  email: "ada@example.com",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function mockApi(handle: MockApiHandle) {
  api.defaults.adapter = handle.adapter;
}

describe("auth.api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    authMocks.signUp.mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null,
    });
    authMocks.signInWithPassword.mockResolvedValue({ error: null });
    authMocks.signOut.mockResolvedValue({ error: null });
  });

  it("getCurrentUser maps snake_case to the frontend User shape", async () => {
    const handle = createMockApiAdapter([route("get", "/auth/me", userPayload)]);
    mockApi(handle);

    const user = await getCurrentUser();

    expect(handle.requests[0]).toMatchObject({ method: "get", path: "/auth/me" });
    expect(user).toEqual({
      id: "u1",
      email: "ada@example.com",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("registerUser signs up with Supabase and syncs the local user", async () => {
    const handle = createMockApiAdapter([noContentRoute("post", "/auth/sync")]);
    mockApi(handle);

    await registerUser({
      email: "ada@example.com",
      password: "12345678",
      confirmPassword: "12345678",
    });

    expect(authMocks.signUp).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "12345678",
    });
    expect(handle.requests[0]).toMatchObject({ method: "post", path: "/auth/sync" });
  });

  it("loginUser signs in with Supabase and syncs the local user", async () => {
    const handle = createMockApiAdapter([noContentRoute("post", "/auth/sync")]);
    mockApi(handle);

    await loginUser({ email: "ada@example.com", password: "12345678" });

    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "12345678",
    });
    expect(handle.requests[0]).toMatchObject({ method: "post", path: "/auth/sync" });
  });

  it("logoutUser signs out from Supabase", async () => {
    await expect(logoutUser()).resolves.toBeUndefined();
    expect(authMocks.signOut).toHaveBeenCalledOnce();
  });

  it("deleteAccount deletes the signed-in account and resolves", async () => {
    const handle = createMockApiAdapter([noContentRoute("delete", "/auth/me")]);
    mockApi(handle);

    await expect(deleteAccount()).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({ method: "delete", path: "/auth/me" });
  });

  it("clears the cached current user when the session check responds 401", async () => {
    const handle = createMockApiAdapter([route("get", "/auth/me", "Unauthorized", 401)]);
    mockApi(handle);

    queryClient.setQueryData<{ id: string }>(["currentUser"], { id: "u1" });
    await expect(getCurrentUser()).rejects.toBeTruthy();

    expect(queryClient.getQueryData(["currentUser"])).toBeNull();
  });

  it("leaves the cached current user alone on a failed login attempt", async () => {
    authMocks.signInWithPassword.mockResolvedValueOnce({
      error: new Error("Invalid login credentials"),
    });
    queryClient.setQueryData<{ id: string }>(["currentUser"], { id: "u1" });
    await expect(
      loginUser({ email: "ada@example.com", password: "wrong-password" }),
    ).rejects.toBeTruthy();

    expect(queryClient.getQueryData(["currentUser"])).toEqual({ id: "u1" });
  });
});