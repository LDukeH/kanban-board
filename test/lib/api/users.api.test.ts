import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/axios";
import { searchUsersByEmail } from "@/lib/api/users.api";
import { createMockApiAdapter, route, type MockApiHandle } from "../../helpers/mockApiModule";

function mockApi(handle: MockApiHandle) {
  api.defaults.adapter = handle.adapter;
}

describe("users.api", () => {
  it("searchUsersByEmail sends the email param and maps the results", async () => {
    const handle = createMockApiAdapter([
      route("get", "/users/search", [{ id: "u1", email: "ada@example.com" }]),
    ]);
    mockApi(handle);

    const users = await searchUsersByEmail("ada@");

    expect(handle.requests[0]).toMatchObject({
      method: "get",
      path: "/users/search",
      params: { email: "ada@" },
    });
    expect(users).toEqual([{ id: "u1", email: "ada@example.com" }]);
  });
});