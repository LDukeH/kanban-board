import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { api } from "@/lib/api/axios";
import { LABEL_COLORS } from "@/lib/colors";
import {
  BOARD_TEMPLATES,
  describeTemplateOutcome,
  getBoardTemplate,
  materializeBoardTemplate,
  type BoardTemplate,
} from "@/lib/templates";
import {
  createMockApiAdapter,
  jsonResponse,
  type MockApiHandle,
  type MockRoute,
} from "../../helpers/mockApiModule";

const TS = "2026-01-01T00:00:00.000Z";

const template: BoardTemplate = {
  id: "t1",
  name: "Test Template",
  description: "Template description",
  columns: [{ name: "To Do" }, { name: "In Progress" }, { name: "Done" }],
  labels: [
    { name: "Bug", color: "#e11941" },
    { name: "Feature", color: "#0ca0d9" },
  ],
};

const boardPayload = {
  id: "b1",
  workspace_id: "ws1",
  name: "My Board",
  description: "Template description",
  created_at: TS,
  updated_at: TS,
};

interface ColumnRequestBody {
  name?: string;
  color?: string;
}

function parseBody(config: InternalAxiosRequestConfig): ColumnRequestBody {
  if (typeof config.data !== "string") {
    return (config.data ?? {}) as ColumnRequestBody;
  }
  return JSON.parse(config.data) as ColumnRequestBody;
}

/**
 * A route whose response depends on how many times it has been hit, so a test
 * can fail call #2 while letting #1 and #3 succeed (a static route cannot do
 * that, since every column shares one path).
 */
function sequenceRoute(
  method: "post",
  pathPart: string,
  respond: (call: number, config: InternalAxiosRequestConfig) => AxiosResponse,
): MockRoute {
  let call = 0;
  return {
    match: (config) =>
      String(config.method ?? "").toLowerCase() === method &&
      String(config.url ?? "").includes(pathPart),
    respond: (config) => {
      call += 1;
      return respond(call, config);
    },
  };
}

/** Every column call succeeds. */
function columnOk(_call: number, config: InternalAxiosRequestConfig) {
  const body = parseBody(config);
  return jsonResponse(
    config,
    {
      id: `c${_call}`,
      board_id: "b1",
      name: body.name,
      position: _call - 1,
      created_at: TS,
      updated_at: TS,
    },
    201,
  );
}

/** The second column call fails with a 500; the rest succeed. */
function columnFailsSecond(call: number, config: InternalAxiosRequestConfig) {
  if (call === 2) return jsonResponse(config, { message: "boom" }, 500);
  return columnOk(call, config);
}

function okLabel(call: number, config: InternalAxiosRequestConfig) {
  const body = parseBody(config);
  return jsonResponse(
    config,
    {
      id: `l${call}`,
      board_id: "b1",
      name: body.name,
      color: body.color,
      created_at: TS,
      updated_at: TS,
    },
    201,
  );
}

function setup(routes: MockRoute[]): MockApiHandle {
  const handle = createMockApiAdapter(routes);
  api.defaults.adapter = handle.adapter;
  return handle;
}

describe("materializeBoardTemplate", () => {
  // materialize logs each failed row on purpose; keep it out of the test output.
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates the board, then every column, then every label in order", async () => {
    const handle = setup([
      sequenceRoute("post", "/workspaces/ws1/boards", (_c, config) =>
        jsonResponse(config, boardPayload, 201),
      ),
      sequenceRoute("post", "/boards/b1/columns", columnOk),
      sequenceRoute("post", "/boards/b1/labels", okLabel),
    ]);

    const result = await materializeBoardTemplate("ws1", template, "My Board");

    expect(handle.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      "post /workspaces/ws1/boards",
      "post /boards/b1/columns",
      "post /boards/b1/columns",
      "post /boards/b1/columns",
      "post /boards/b1/labels",
      "post /boards/b1/labels",
    ]);
    expect(handle.requests[0].data).toEqual({
      name: "My Board",
      description: "Template description",
    });

    expect(result.board.id).toBe("b1");
    expect(result.createdColumns.map((c) => c.name)).toEqual([
      "To Do",
      "In Progress",
      "Done",
    ]);
    expect(result.failedColumns).toEqual([]);
    expect(result.createdLabels.map((l) => l.color)).toEqual([
      "#e11941",
      "#0ca0d9",
    ]);
    expect(result.failedLabels).toEqual([]);

    const outcome = describeTemplateOutcome(result);
    expect(outcome.complete).toBe(true);
    expect(outcome.message).toBe(
      'Board "My Board" created with 3 columns and 2 labels.',
    );
  });

  it("keeps going after a failed column and reports exactly what exists", async () => {
    const handle = setup([
      sequenceRoute("post", "/workspaces/ws1/boards", (_c, config) =>
        jsonResponse(config, boardPayload, 201),
      ),
      sequenceRoute("post", "/boards/b1/columns", columnFailsSecond),
      sequenceRoute("post", "/boards/b1/labels", okLabel),
    ]);

    const result = await materializeBoardTemplate("ws1", template, "My Board");

    // Column #2 failed but #3 still ran, and every label was still attempted.
    expect(handle.requests.filter((r) => r.path.includes("/columns"))).toHaveLength(3);
    expect(result.createdColumns.map((c) => c.name)).toEqual(["To Do", "Done"]);
    expect(result.failedColumns).toEqual(["In Progress"]);
    expect(result.createdLabels).toHaveLength(2);

    const outcome = describeTemplateOutcome(result);
    expect(outcome.complete).toBe(false);
    expect(outcome.message).toContain('Board "My Board" was created');
    expect(outcome.message).toContain("2 of 3 columns");
    expect(outcome.message).toContain("2 of 2 labels");
    expect(outcome.message).toContain("columns: In Progress");
  });

  it("reports failed labels alongside successful columns", async () => {
    setup([
      sequenceRoute("post", "/workspaces/ws1/boards", (_c, config) =>
        jsonResponse(config, boardPayload, 201),
      ),
      sequenceRoute("post", "/boards/b1/columns", (_call, config) =>
        jsonResponse(
          config,
          {
            id: `c${config.data}`,
            board_id: "b1",
            name: parseBody(config).name,
            position: 0,
            created_at: TS,
            updated_at: TS,
          },
          201,
        ),
      ),
      sequenceRoute("post", "/boards/b1/labels", (_c, config) =>
        jsonResponse(config, { message: "nope" }, 500),
      ),
    ]);

    const result = await materializeBoardTemplate("ws1", template, "My Board");

    expect(result.createdColumns).toHaveLength(3);
    expect(result.failedColumns).toEqual([]);
    expect(result.createdLabels).toEqual([]);
    expect(result.failedLabels).toEqual(["Bug", "Feature"]);

    const outcome = describeTemplateOutcome(result);
    expect(outcome.complete).toBe(false);
    expect(outcome.message).toContain("3 of 3 columns");
    expect(outcome.message).toContain("0 of 2 labels");
    expect(outcome.message).toContain("labels: Bug, Feature");
  });

  it("throws on board failure without attempting columns or labels", async () => {
    const handle = setup([
      sequenceRoute("post", "/workspaces/ws1/boards", (_c, config) =>
        jsonResponse(config, { message: "denied" }, 403),
      ),
    ]);

    await expect(
      materializeBoardTemplate("ws1", template, "My Board"),
    ).rejects.toThrow();

    expect(handle.requests).toHaveLength(1);
    expect(handle.requests[0].path).toBe("/workspaces/ws1/boards");
  });
});

describe("BOARD_TEMPLATES", () => {
  it("exposes unique ids and at least one column per preset", () => {
    const ids = BOARD_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of BOARD_TEMPLATES) {
      expect(preset.columns.length).toBeGreaterThan(0);
      expect(preset.name.length).toBeGreaterThan(0);
    }
  });

  it("only uses label colours the colour picker offers", () => {
    for (const preset of BOARD_TEMPLATES) {
      for (const label of preset.labels) {
        expect(LABEL_COLORS).toContain(label.color);
      }
    }
  });

  it("resolves a preset by id", () => {
    expect(getBoardTemplate("basic-kanban")?.name).toBe("Basic Kanban");
    expect(getBoardTemplate("nope")).toBeUndefined();
  });
});
