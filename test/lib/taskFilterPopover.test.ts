import { describe, expect, it } from "vitest";
import { emptyTaskFilter, type TaskFilter } from "@/lib/taskFilter";
import {
  assigneeName,
  describeAssigneeSelection,
  describeLabelSelection,
  filterOptionHint,
  isAssigneeFilterActive,
  isLabelFilterActive,
  matchMembersByQuery,
  matchLabelsByQuery,
  namedSelection,
  normalizeFilterQuery,
  sortLabelsByName,
  toggleEnumValue,
  updateTaskFilter,
  toggleFilterAssignee,
  toggleNoAssignees,
  toggleFilterLabel,
  toggleNoLabels,
} from "@/lib/taskFilterPopover";
import type { Label } from "@/types/board";
import type { WorkspaceMember } from "@/types/workspace";

function filter(overrides: Partial<TaskFilter> = {}): TaskFilter {
  return { ...emptyTaskFilter(), ...overrides };
}

function member(overrides: Partial<WorkspaceMember> = {}): WorkspaceMember {
  return {
    id: "m1",
    workspaceId: "w1",
    userId: "u1",
    role: "member",
    email: "lee@example.com",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

function label(overrides: Partial<Label> = {}): Label {
  return {
    id: "l1",
    boardId: "b1",
    name: "Bug",
    color: "#e11941",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

describe("taskFilterPopover pure logic (mirrors TaskFilterPopover behavior)", () => {
  it("namedSelection summarizes empty and multi selections", () => {
    expect(namedSelection([], (v) => v)).toBe("All");
    expect(namedSelection(["a@x.com"], assigneeName)).toBe("A");
    expect(namedSelection(["a@x.com", "b@x.com"], assigneeName)).toBe("A +1");
  });

  it("assigneeName uses the email local part", () => {
    expect(assigneeName("lee@example.com")).toBe("Lee");
    expect(assigneeName("plain")).toBe("Plain");
  });

  it("toggleEnumValue toggles membership without mutating the input", () => {
    const selected = ["low"] as const;
    expect(toggleEnumValue([...selected], "low")).toEqual([]);
    expect(toggleEnumValue([], "high")).toEqual(["high"]);
  });

  it("updateTaskFilter merges a patch over the current filter", () => {
    const next = updateTaskFilter(filter({ query: "a" }), { query: "b" });
    expect(next.query).toBe("b");
  });

  it("assignee toggles clear the unassigned flag and vice versa", () => {
    const picked = toggleFilterAssignee(filter(), "a@x.com");
    expect(picked.assigneeEmails).toEqual(["a@x.com"]);
    expect(picked.hasNoAssignees).toBe(false);

    const removed = toggleFilterAssignee(picked, "a@x.com");
    expect(removed.assigneeEmails).toEqual([]);

    const unassigned = toggleNoAssignees(filter({ assigneeEmails: ["a@x.com"] }));
    expect(unassigned).toMatchObject({ hasNoAssignees: true, assigneeEmails: [] });
    expect(toggleNoAssignees(unassigned).hasNoAssignees).toBe(false);
  });

  it("label toggles clear the no-labels flag and vice versa", () => {
    const picked = toggleFilterLabel(filter(), "Bug");
    expect(picked.labelNames).toEqual(["Bug"]);
    expect(picked.hasNoLabels).toBe(false);

    const removed = toggleFilterLabel(picked, "Bug");
    expect(removed.labelNames).toEqual([]);

    const noLabels = toggleNoLabels(filter({ labelNames: ["Bug"] }));
    expect(noLabels).toMatchObject({ hasNoLabels: true, labelNames: [] });
    expect(toggleNoLabels(noLabels).hasNoLabels).toBe(false);
  });

  it("describes the active assignee/label rows like the popover summaries", () => {
    expect(isAssigneeFilterActive(filter())).toBe(false);
    expect(isAssigneeFilterActive(filter({ hasNoAssignees: true }))).toBe(true);
    expect(isLabelFilterActive(filter({ labelNames: ["Bug"] }))).toBe(true);
    expect(describeAssigneeSelection(filter({ hasNoAssignees: true }))).toBe("Unassigned");
    expect(describeLabelSelection(filter({ hasNoLabels: true }))).toBe("No labels");
    expect(describeAssigneeSelection(filter({ assigneeEmails: ["lee@example.com"] }))).toBe("Lee");
  });

  it("normalizes the search query and narrows options without touching selections", () => {
    expect(normalizeFilterQuery("  Bug ")).toBe("bug");
    const members = [member(), member({ id: "m2", userId: "u2", email: "ann@example.com" })];
    expect(matchMembersByQuery(members, "LEE").map((m) => m.email)).toEqual(["lee@example.com"]);
    expect(matchMembersByQuery(members, "").length).toBe(2);
    const labels = [label(), label({ id: "l2", name: "Feature" })];
    expect(matchLabelsByQuery(labels, "fea").map((l) => l.name)).toEqual(["Feature"]);
    expect(sortLabelsByName([labels[1], labels[0]]).map((l) => l.name)).toEqual(["Bug", "Feature"]);
  });

  it("advertises submenu sizes like the popover hints", () => {
    expect(filterOptionHint(1, "member")).toBe("1 member");
    expect(filterOptionHint(2, "member")).toBe("2 members");
    expect(filterOptionHint(0, "label")).toBe("0 labels");
  });
});
