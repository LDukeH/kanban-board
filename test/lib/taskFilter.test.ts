import { describe, expect, it } from "vitest";
import {
  clearTaskFilter,
  emptyTaskFilter,
  filterFromSearchParams,
  filterToSearchParams,
  isTaskFilterActive,
  loadBoardTaskFilter,
  matchesTaskFilter,
  saveBoardTaskFilter,
  taskFilterCount,
  topLabelsByUsage,
  type TaskFilter,
} from "@/lib/taskFilter";
import { makeLabel, makeTask } from "../fixtures";
import { failStorageAccess, readRawStorage } from "../helpers/storageShim";

function filter(overrides: Partial<TaskFilter> = {}): TaskFilter {
  return {
    ...emptyTaskFilter(),
    ...overrides,
  };
}

describe("filter state helpers", () => {
  it("emptyTaskFilter returns the documented default and a fresh object each call", () => {
    expect(emptyTaskFilter()).toEqual(filter());
    expect(emptyTaskFilter()).not.toBe(emptyTaskFilter());
  });

  it("clearTaskFilter returns a fresh empty filter", () => {
    const previous = filter({ query: "hi", hasNoAssignees: true });
    const cleared = clearTaskFilter();
    expect(cleared).toEqual(emptyTaskFilter());
    expect(cleared).not.toBe(previous);
  });

  it("isTaskFilterActive ignores whitespace-only queries", () => {
    expect(isTaskFilterActive(filter())).toBe(false);
    expect(isTaskFilterActive(filter({ query: "   " }))).toBe(false);
    expect(isTaskFilterActive(filter({ query: "x" }))).toBe(true);
    expect(isTaskFilterActive(filter({ hasNoAssignees: true }))).toBe(true);
    expect(isTaskFilterActive(filter({ assigneeEmails: ["a@b.com"] }))).toBe(true);
    expect(isTaskFilterActive(filter({ hasNoLabels: true }))).toBe(true);
    expect(isTaskFilterActive(filter({ labelNames: ["Bug"] }))).toBe(true);
  });

  it("taskFilterCount counts active groups and selected values", () => {
    expect(taskFilterCount(filter())).toBe(0);
    expect(taskFilterCount(filter({ query: "  " }))).toBe(0);
    expect(taskFilterCount(filter({ query: "x" }))).toBe(1);
    expect(taskFilterCount(filter({ hasNoAssignees: true }))).toBe(1);
    expect(taskFilterCount(filter({ hasNoLabels: true }))).toBe(1);
    expect(taskFilterCount(filter({ assigneeEmails: ["a@b.com", "c@d.com"] }))).toBe(2);
    expect(taskFilterCount(filter({ labelNames: ["Bug"] }))).toBe(1);
    expect(
      taskFilterCount(
        filter({
          query: "x",
          hasNoAssignees: true,
          assigneeEmails: ["a@b.com"],
          hasNoLabels: true,
          labelNames: ["Bug"],
        }),
      ),
    ).toBe(5);
  });
});

describe("search matching", () => {
  const searchable = () =>
    makeTask({
      id: "t1",
      title: "Fix the Board",
      assignees: [{ user_id: "u1", email: "Ada@Example.com" }],
      labels: [makeLabel({ id: "l1", name: "Urgent" })],
    });

  it("matches title, assignee email, and label name case-insensitively", () => {
    expect(matchesTaskFilter(searchable(), filter({ query: "fix" }))).toBe(true);
    expect(matchesTaskFilter(searchable(), filter({ query: "ADA@example.COM" }))).toBe(true);
    expect(matchesTaskFilter(searchable(), filter({ query: "urgent" }))).toBe(true);
  });

  it("uses OR behavior across title, assignee, and label", () => {
    const byTitle = makeTask({ id: "a", title: "Only title has it" });
    const byAssignee = makeTask({
      id: "b",
      title: "plain",
      assignees: [{ user_id: "u", email: "needle@x.com" }],
    });
    const byLabel = makeTask({ id: "c", title: "plain", labels: [makeLabel({ name: "needle" })] });
    const query = filter({ query: "needle" });
    expect(matchesTaskFilter(byTitle, query)).toBe(false);
    expect(matchesTaskFilter(byAssignee, query)).toBe(true);
    expect(matchesTaskFilter(byLabel, query)).toBe(true);
  });

  it("excludes tasks that do not match the query", () => {
    expect(matchesTaskFilter(searchable(), filter({ query: "zzz" }))).toBe(false);
  });

  it("does not exclude tasks for empty or whitespace-only queries", () => {
    const task = makeTask({ title: "anything" });
    expect(matchesTaskFilter(task, filter())).toBe(true);
    expect(matchesTaskFilter(task, filter({ query: "   " }))).toBe(true);
  });
});
describe("assignee and label group matching", () => {
  const withAssignee = makeTask({
    id: "a",
    assignees: [
      { user_id: "u1", email: "ada@example.com" },
      { user_id: "u2", email: "grace@example.com" },
    ],
  });
  const withoutAssignee = makeTask({ id: "b", assignees: [] });

  it("hasNoAssignees matches only tasks with zero assignees", () => {
    expect(matchesTaskFilter(withAssignee, filter({ hasNoAssignees: true }))).toBe(false);
    expect(matchesTaskFilter(withoutAssignee, filter({ hasNoAssignees: true }))).toBe(true);
  });

  it("selected assignees match when any selected email is present (OR)", () => {
    expect(matchesTaskFilter(withAssignee, filter({ assigneeEmails: ["ada@example.com"] }))).toBe(true);
    expect(matchesTaskFilter(withAssignee, filter({ assigneeEmails: ["other@example.com"] }))).toBe(false);
    expect(
      matchesTaskFilter(
        withAssignee,
        filter({ assigneeEmails: ["other@example.com", "grace@example.com"] }),
      ),
    ).toBe(true);
  });

  const withLabel = makeTask({
    id: "c",
    labels: [makeLabel({ id: "l1", name: "Bug" }), makeLabel({ id: "l2", name: "High" })],
  });
  const withoutLabel = makeTask({ id: "d", labels: [] });

  it("hasNoLabels matches only tasks with zero labels", () => {
    expect(matchesTaskFilter(withLabel, filter({ hasNoLabels: true }))).toBe(false);
    expect(matchesTaskFilter(withoutLabel, filter({ hasNoLabels: true }))).toBe(true);
  });

  it("selected labels match when any selected name is present (OR)", () => {
    expect(matchesTaskFilter(withLabel, filter({ labelNames: ["Bug"] }))).toBe(true);
    expect(matchesTaskFilter(withLabel, filter({ labelNames: ["Missing"] }))).toBe(false);
    // Selectors are exact (case-sensitive) matches — only the search bar lowercases.
    expect(matchesTaskFilter(withLabel, filter({ labelNames: ["Missing", "High"] }))).toBe(true);
    expect(matchesTaskFilter(withLabel, filter({ labelNames: ["high"] }))).toBe(false);
  });

  it("combines assignee and label groups with AND behavior", () => {
    const both = filter({ assigneeEmails: ["ada@example.com"], labelNames: ["Bug"] });
    expect(matchesTaskFilter(withAssignee, both)).toBe(false); // no labels
    expect(matchesTaskFilter(withLabel, both)).toBe(false); // no assignees

    const combined = makeTask({
      id: "e",
      assignees: [{ user_id: "u1", email: "ada@example.com" }],
      labels: [makeLabel({ id: "l1", name: "Bug" })],
    });
    expect(matchesTaskFilter(combined, both)).toBe(true);
  });
});

describe("metadata group matching", () => {
  const urgent = makeTask({
    id: "urgent",
    priority: "high",
    dueDate: "2000-01-01",
  });
  const done = makeTask({
    id: "done",
    priority: "low",
    dueDate: "2000-01-01",
    completed: true,
  });
  const plain = makeTask({ id: "plain", priority: "none", dueDate: null });

  it("an empty selection matches every task", () => {
    for (const task of [urgent, done, plain]) {
      expect(matchesTaskFilter(task, filter())).toBe(true);
    }
  });

  it("priority matches only the selected values", () => {
    expect(matchesTaskFilter(urgent, filter({ priorities: ["high"] }))).toBe(true);
    expect(matchesTaskFilter(plain, filter({ priorities: ["high"] }))).toBe(false);
    // Multiple values are OR-ed within the group.
    expect(
      matchesTaskFilter(done, filter({ priorities: ["high", "low"] })),
    ).toBe(true);
  });

  it("due status buckets dated, overdue and undated tasks", () => {
    expect(
      matchesTaskFilter(urgent, filter({ dueStatuses: ["overdue"] })),
    ).toBe(true);
    expect(
      matchesTaskFilter(plain, filter({ dueStatuses: ["unscheduled"] })),
    ).toBe(true);
    expect(
      matchesTaskFilter(plain, filter({ dueStatuses: ["overdue"] })),
    ).toBe(false);
  });

  it("a completed task with a past due date is scheduled, never overdue", () => {
    expect(
      matchesTaskFilter(done, filter({ dueStatuses: ["scheduled"] })),
    ).toBe(true);
    expect(
      matchesTaskFilter(done, filter({ dueStatuses: ["overdue"] })),
    ).toBe(false);
  });

  it("completion matches the flag", () => {
    expect(
      matchesTaskFilter(done, filter({ completion: ["completed"] })),
    ).toBe(true);
    expect(matchesTaskFilter(done, filter({ completion: ["active"] }))).toBe(false);
    expect(matchesTaskFilter(plain, filter({ completion: ["active"] }))).toBe(true);
  });

  it("ANDs metadata groups together with the other filter groups", () => {
    const combined = filter({
      priorities: ["high"],
      dueStatuses: ["overdue"],
      completion: ["active"],
    });
    expect(matchesTaskFilter(urgent, combined)).toBe(true);
    // Same priority and due state, but completed fails the completion group.
    expect(matchesTaskFilter(done, combined)).toBe(false);
  });

  it("isTaskFilterActive and taskFilterCount see every metadata group", () => {
    expect(isTaskFilterActive(filter({ priorities: ["high"] }))).toBe(true);
    expect(isTaskFilterActive(filter({ dueStatuses: ["overdue"] }))).toBe(true);
    expect(isTaskFilterActive(filter({ completion: ["completed"] }))).toBe(true);

    expect(taskFilterCount(filter({ priorities: ["high", "low"] }))).toBe(2);
    expect(
      taskFilterCount(
        filter({ priorities: ["high"], dueStatuses: ["overdue"], completion: ["active"] }),
      ),
    ).toBe(3);
  });
});

describe("topLabelsByUsage", () => {
  const alpha = makeLabel({ id: "l1", name: "Alpha" });
  const beta = makeLabel({ id: "l2", name: "Beta" });

  it("ranks labels by usage count across tasks", () => {
    const tasks = [
      makeTask({ labels: [alpha, beta] }),
      makeTask({ labels: [alpha] }),
      makeTask({ labels: [] }),
    ];
    expect(topLabelsByUsage(tasks, 2).map((l) => l.id)).toEqual(["l1", "l2"]);
  });

  it("honors the limit", () => {
    const tasks = [makeTask({ labels: [alpha, beta] })];
    expect(topLabelsByUsage(tasks, 1).map((l) => l.id)).toEqual(["l1"]);
    expect(topLabelsByUsage(tasks, 0)).toEqual([]);
  });

  it("breaks ties by name alphabetically", () => {
    const tasks = [
      makeTask({ labels: [makeLabel({ id: "z", name: "Zulu" })] }),
      makeTask({ labels: [makeLabel({ id: "a", name: "Apple" })] }),
    ];
    expect(topLabelsByUsage(tasks, 2).map((l) => l.name)).toEqual(["Apple", "Zulu"]);
  });
});
describe("URL serialization", () => {
  it("serializes only active values and trims the query", () => {
    expect(filterToSearchParams(filter())).toEqual({});
    expect(filterToSearchParams(filter({ query: "  hi  " }))).toEqual({ q: "hi" });
  });

  it("encodes comma-joined assignees, labels, and the 1 flags", () => {
    const params = filterToSearchParams(
      filter({
        query: "hello world",
        hasNoAssignees: true,
        assigneeEmails: ["ada@example.com", "bob+tag@example.com"],
        hasNoLabels: true,
        labelNames: ["Priority: High", "bug"],
      }),
    );
    expect(params).toEqual({
      q: "hello world",
      no_assignees: "1",
      assignees: "ada%40example.com,bob%2Btag%40example.com",
      no_labels: "1",
      labels: "Priority%3A%20High,bug",
    });
  });

  it("serializes metadata groups as bare comma-joined enum tokens", () => {
    const params = filterToSearchParams(
      filter({
        priorities: ["high", "low"],
        dueStatuses: ["overdue"],
        completion: ["completed"],
      }),
    );
    expect(params).toEqual({
      priority: "high,low",
      due: "overdue",
      completion: "completed",
    });
  });
});

describe("URL parsing", () => {
  it("returns the empty filter for missing parameters", () => {
    expect(filterFromSearchParams(new URLSearchParams(""))).toEqual(emptyTaskFilter());
  });

  it("reads query text and ignores unrelated keys", () => {
    const parsed = filterFromSearchParams(new URLSearchParams("q=hi&unrelated=1"));
    expect(parsed).toEqual(filter({ query: "hi" }));
  });

  it("treats flags as true only for the literal 1", () => {
    expect(filterFromSearchParams(new URLSearchParams("no_assignees=true")).hasNoAssignees).toBe(false);
    expect(filterFromSearchParams(new URLSearchParams("no_assignees=1")).hasNoAssignees).toBe(true);
    expect(filterFromSearchParams(new URLSearchParams("no_labels=1")).hasNoLabels).toBe(true);
  });

  it("reads metadata tokens and drops values that are not in the closed set", () => {
    const parsed = filterFromSearchParams(
      new URLSearchParams(
        "priority=high,urgent&due=overdue,whenever&completion=completed,nope",
      ),
    );
    expect(parsed.priorities).toEqual(["high"]);
    expect(parsed.dueStatuses).toEqual(["overdue"]);
    expect(parsed.completion).toEqual(["completed"]);
  });

  it("round-trips every metadata group through serialize and parse", () => {
    const original = filter({
      priorities: ["high", "none"],
      dueStatuses: ["overdue", "unscheduled"],
      completion: ["active"],
    });
    expect(
      filterFromSearchParams(new URLSearchParams(filterToSearchParams(original))),
    ).toEqual({
      ...emptyTaskFilter(),
      priorities: ["high", "none"],
      dueStatuses: ["overdue", "unscheduled"],
      completion: ["active"],
    });
  });

  it("decodes, trims, and filters empty comma-separated values", () => {
    const parsed = filterFromSearchParams(
      new URLSearchParams("assignees=a%40b.com,,%20c%40d.com%20&labels=%20Bug%20,,High"),
    );
    expect(parsed.assigneeEmails).toEqual(["a@b.com", "c@d.com"]);
    expect(parsed.labelNames).toEqual(["Bug", "High"]);
  });

  it("round-trips a full filter through serialize and parse", () => {
    const original = filter({
      query: "  urgent  ",
      hasNoAssignees: true,
      assigneeEmails: ["ada@example.com", "an+email@x.com"],
      hasNoLabels: true,
      labelNames: ["Priority: High", "bug"],
    });
    const params = filterToSearchParams(original);
    expect(filterFromSearchParams(new URLSearchParams(params))).toEqual({
      query: "urgent",
      hasNoAssignees: true,
      assigneeEmails: ["ada@example.com", "an+email@x.com"],
      hasNoLabels: true,
      labelNames: ["Priority: High", "bug"],
      priorities: [],
      dueStatuses: [],
      completion: [],
    });
  });
});

describe("local persistence", () => {
  const storageKey = "kanbanBoard.taskFilter.board-1";

  it("saves and loads the same filter", () => {
    const saved = filter({ query: "bug", assigneeEmails: ["ada@example.com"] });
    saveBoardTaskFilter("board-1", saved);
    expect(loadBoardTaskFilter("board-1")).toEqual(saved);
    expect(readRawStorage("local", storageKey)).toBe(JSON.stringify(saved));
  });

  it("returns the empty filter when nothing is stored", () => {
    expect(loadBoardTaskFilter("board-1")).toEqual(emptyTaskFilter());
  });

  it("returns the empty filter for malformed JSON", () => {
    globalThis.localStorage.setItem(storageKey, "{not json");
    expect(loadBoardTaskFilter("board-1")).toEqual(emptyTaskFilter());
  });

  it("merges partial stored values with valid defaults", () => {
    globalThis.localStorage.setItem(storageKey, JSON.stringify({ query: "hi" }));
    expect(loadBoardTaskFilter("board-1")).toEqual(filter({ query: "hi" }));
  });

  it("does not throw when storage is unavailable", () => {
    failStorageAccess("local", "setItem");
    expect(() => saveBoardTaskFilter("board-1", filter({ query: "x" }))).not.toThrow();

    failStorageAccess("local", "getItem");
    expect(loadBoardTaskFilter("board-1")).toEqual(emptyTaskFilter());
  });
});