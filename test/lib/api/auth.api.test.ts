import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/axios";
import { deleteAccount, getCurrentUser, loginUser, logoutUser, registerUser } from "@/lib/api/auth.api";
import { queryClient } from "@/lib/queryClient";
import { createMockApiAdapter, noContentRoute, route, type MockApiHandle } from "../../helpers/mockApiModule";

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

  it("registerUser posts the form payload and returns the raw response", async () => {
    const handle = createMockApiAdapter([route("post", "/auth/register", { ok: true })]);
    mockApi(handle);

    const result = await registerUser({
      email: "ada@example.com",
      password: "12345678",
      confirmPassword: "12345678",
    });

    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/auth/register",
      data: { email: "ada@example.com", password: "12345678", confirmPassword: "12345678" },
    });
    expect(result).toEqual({ ok: true });
  });

  it("loginUser posts the credentials and returns the raw response", async () => {
    const handle = createMockApiAdapter([route("post", "/auth/login", { ok: true })]);
    mockApi(handle);

    const result = await loginUser({ email: "ada@example.com", password: "12345678" });

    expect(handle.requests[0]).toMatchObject({ method: "post", path: "/auth/login" });
    expect(result).toEqual({ ok: true });
  });

  it("logoutUser posts to /auth/logout and resolves", async () => {
    const handle = createMockApiAdapter([noContentRoute("post", "/auth/logout")]);
    mockApi(handle);

    await expect(logoutUser()).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({ method: "post", path: "/auth/logout" });
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
    const handle = createMockApiAdapter([route("post", "/auth/login", "Unauthorized", 401)]);
    mockApi(handle);

    queryClient.setQueryData<{ id: string }>(["currentUser"], { id: "u1" });
    await expect(
      loginUser({ email: "ada@example.com", password: "wrong-password" }),
    ).rejects.toBeTruthy();

    expect(queryClient.getQueryData(["currentUser"])).toEqual({ id: "u1" });
  });
});