import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

/**
 * Real axios client + fake transport adapter. This keeps the real request
 * normalization, response handling and validation (including dispatchRequest's
 * validateStatus rejection path), and only swaps out the network hop — closer to
 * the skill's "real serialization behavior over mocks" guidance than mocking the
 * whole `@/lib/api/axios` module.
 *
 * Usage in a test:
 *
 *   const handle = createMockApiAdapter([route("get", "/boards/1", payload)]);
 *   api.defaults.adapter = handle.adapter;
 *   const result = await getBoard("1");
 *   expect(handle.requests[0].path).toBe("/boards/1");
 */

export interface ApiRequestRecord {
  method: string;
  /** `config.url` with any configured baseURL stripped. */
  path: string;
  params?: unknown;
  data?: unknown;
}

export interface MockRoute {
  match: (config: InternalAxiosRequestConfig) => boolean;
  respond: (config: InternalAxiosRequestConfig) => AxiosResponse;
}

export interface MockApiHandle {
  /** Every request the fake transport received since the last reset. */
  requests: ApiRequestRecord[];
  reset: () => void;
  /** Assign to `api.defaults.adapter` (e.g. in beforeEach). */
  adapter: AxiosAdapter;
}

export function createMockApiAdapter(routes: MockRoute[]): MockApiHandle {
  const requests: ApiRequestRecord[] = [];

  const adapter: AxiosAdapter = async (config) => {
    const base = String(config.baseURL ?? "");
    const rawUrl = String(config.url ?? "");
    const path = base && rawUrl.startsWith(base) ? rawUrl.slice(base.length) : rawUrl;

    requests.push({
      method: config.method ?? "",
      path,
      params: config.params,
      // Axios runs default transformRequest before the adapter, so object
      // bodies arrive JSON-serialized; parse them back for readable assertions.
      data: parseRequestData(config.data),
    });

    const route = routes.find((candidate) => candidate.match(config));
    if (!route) {
      throw new Error(`No mock route matched ${String(config.method).toUpperCase()} ${path}`);
    }

    const response = route.respond(config);

    // Axios delegates status validation to the adapter (settle). Custom adapters
    // must reject non-2xx themselves, otherwise a 401 would resolve as a success
    // and the production 401 interceptor would never run.
    const validateStatus = config.validateStatus ?? ((status: number) => status >= 200 && status < 300);
    if (!validateStatus(response.status)) {
      throw createAxiosLikeError(response, config);
    }

    return response;
  };

  return {
    requests,
    reset: () => {
      requests.length = 0;
    },
    adapter,
  };
}

function createAxiosLikeError(
  response: AxiosResponse,
  config: InternalAxiosRequestConfig,
): Error & { isAxiosError: boolean; response: AxiosResponse; config: InternalAxiosRequestConfig } {
  const error = new Error(`Request failed with status code ${response.status}`) as Error & {
    isAxiosError: boolean;
    response: AxiosResponse;
    config: InternalAxiosRequestConfig;
  };
  error.isAxiosError = true;
  error.response = response;
  error.config = config;
  return error;
}

function parseRequestData(data: unknown): unknown {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export function jsonResponse(
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
): AxiosResponse {
  return {
    data,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    headers: {},
    config,
  };
}

export function noContentResponse(config: InternalAxiosRequestConfig): AxiosResponse {
  return jsonResponse(config, undefined, 204);
}

function matches(config: InternalAxiosRequestConfig, method: string, pathIncludes: string) {
  return (
    String(config.method ?? "").toLowerCase() === method &&
    String(config.url ?? "").includes(pathIncludes)
  );
}

/** Convenience build for a successful JSON route. */
export function route(
  method: "get" | "post" | "patch" | "delete",
  pathIncludes: string,
  data: unknown,
  status = 200,
): MockRoute {
  return {
    match: (config) => matches(config, method, pathIncludes),
    respond: (config) => jsonResponse(config, data, status),
  };
}

/** Convenience build for a 204 No Content route. */
export function noContentRoute(
  method: "get" | "post" | "patch" | "delete",
  pathIncludes: string,
): MockRoute {
  return {
    match: (config) => matches(config, method, pathIncludes),
    respond: noContentResponse,
  };
}

/**
 * Route matching by exact URL suffix. Safer than substring matching for request
 * cascades (e.g. `findBoardIdForTask`) where several endpoints share prefixes:
 * "/workspaces" must never swallow "/workspaces/ws1/boards".
 */
export function suffixRoute(
  method: "get" | "post" | "patch" | "delete",
  suffix: string,
  data: unknown,
  status = 200,
): MockRoute {
  return {
    match: (config) =>
      String(config.method ?? "").toLowerCase() === method &&
      String(config.url ?? "").endsWith(suffix),
    respond: (config) => jsonResponse(config, data, status),
  };
}