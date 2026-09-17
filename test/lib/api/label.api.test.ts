import { describe, expect, it } from "vitest";
import { api } from "@/lib/api/axios";
import {
  addLabelToTask,
  createLabel,
  deleteLabel,
  getBoardLabels,
  getLabel,
  mapAssignee,
  mapLabel,
  removeLabelFromTask,
  updateLabel,
} from "@/lib/api/label.api";
import { createMockApiAdapter, noContentRoute, route, type MockApiHandle } from "../../helpers/mockApiModule";

const labelPayload = {
  id: "l1",
  board_id: "b1",
  name: "Bug",
  color: "#e11941",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const mappedLabel = {
  id: "l1",
  boardId: "b1",
  name: "Bug",
  color: "#e11941",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function mockApi(handle: MockApiHandle) {
  api.defaults.adapter = handle.adapter;
}

describe("label.api mappers", () => {
  it("mapLabel converts snake_case to camelCase", () => {
    expect(mapLabel(labelPayload)).toEqual(mappedLabel);
  });

  it("mapAssignee keeps user_id and email", () => {
    expect(mapAssignee({ user_id: "u1", email: "a@b.com" })).toEqual({
      user_id: "u1",
      email: "a@b.com",
    });
  });
});

describe("label.api", () => {
  it("getBoardLabels maps the label list", async () => {
    const handle = createMockApiAdapter([route("get", "/boards/b1/labels", [labelPayload])]);
    mockApi(handle);

    await expect(getBoardLabels("b1")).resolves.toEqual([mappedLabel]);
    expect(handle.requests[0]).toMatchObject({ method: "get", path: "/boards/b1/labels" });
  });

  it("getLabel maps a single label", async () => {
    const handle = createMockApiAdapter([route("get", "/labels/l1", labelPayload)]);
    mockApi(handle);

    await expect(getLabel("l1")).resolves.toEqual(mappedLabel);
  });

  it("createLabel posts name and color and maps the response", async () => {
    const handle = createMockApiAdapter([route("post", "/boards/b1/labels", labelPayload)]);
    mockApi(handle);

    await expect(createLabel("b1", { name: "Bug", color: "#e11941" })).resolves.toEqual(mappedLabel);
    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/boards/b1/labels",
      data: { name: "Bug", color: "#e11941" },
    });
  });

  it("updateLabel patches without mapping (void)", async () => {
    const handle = createMockApiAdapter([noContentRoute("patch", "/labels/l1")]);
    mockApi(handle);

    await expect(updateLabel("l1", { name: "Bug 2", color: "#f4881f" })).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({
      method: "patch",
      path: "/labels/l1",
      data: { name: "Bug 2", color: "#f4881f" },
    });
  });

  it("deleteLabel issues a DELETE and resolves", async () => {
    const handle = createMockApiAdapter([noContentRoute("delete", "/labels/l1")]);
    mockApi(handle);

    await expect(deleteLabel("l1")).resolves.toBeUndefined();
  });

  it("addLabelToTask posts the label_id", async () => {
    const handle = createMockApiAdapter([noContentRoute("post", "/tasks/t1/labels")]);
    mockApi(handle);

    await expect(addLabelToTask("t1", "l1")).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({
      method: "post",
      path: "/tasks/t1/labels",
      data: { label_id: "l1" },
    });
  });

  it("removeLabelFromTask issues a DELETE for the label", async () => {
    const handle = createMockApiAdapter([noContentRoute("delete", "/tasks/t1/labels/l1")]);
    mockApi(handle);

    await expect(removeLabelFromTask("t1", "l1")).resolves.toBeUndefined();
    expect(handle.requests[0]).toMatchObject({ method: "delete", path: "/tasks/t1/labels/l1" });
  });
});