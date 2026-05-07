import { ApiError } from "./errors";
import type { CallOptions, TypedClient } from "./types";
import { buildUrl, type Primitive, type QueryValue } from "./url";

export type Operation = {
  readonly path: string;
  readonly method: "get" | "post" | "put" | "patch" | "delete" | "options" | "head";
  readonly operationId: string;
  readonly pathParams?: readonly string[];
  readonly queryParams?: readonly string[];
  readonly hasBody?: boolean;
};

export type OperationsTable = {
  readonly [group: string]: { readonly [opId: string]: Operation };
};

export type ClientConfig = {
  baseUrl?: string;
  fetch?: typeof fetch;
  defaultHeaders?: Record<string, string>;
};

export type { CallOptions };

export function createClient<TPaths, TOps extends OperationsTable>(operations: TOps, config: ClientConfig = {}): TypedClient<TPaths, TOps> {
  const fetchImpl = config.fetch ?? fetch;
  const baseUrl = config.baseUrl ?? "";
  const defaultHeaders = config.defaultHeaders ?? {};

  return new Proxy(
    {},
    {
      has(_, group) {
        return typeof group === "string" && group in operations;
      },
      get(_, group) {
        if (typeof group !== "string" || !(group in operations)) return undefined;
        return createOperationGroupProxy(operations[group], baseUrl, fetchImpl, defaultHeaders);
      }
    }
  ) as TypedClient<TPaths, TOps>;
}

function createOperationGroupProxy(
  groupOperations: Readonly<Record<string, Operation>>,
  baseUrl: string,
  fetchImpl: typeof fetch,
  defaultHeaders: Record<string, string>
) {
  return new Proxy(
    {},
    {
      has(_, opId) {
        return typeof opId === "string" && opId in groupOperations;
      },
      get(_, opId) {
        if (typeof opId !== "string") return undefined;
        const op = groupOperations[opId];
        if (!op) return undefined;
        return createOperationCaller(op, baseUrl, fetchImpl, defaultHeaders);
      }
    }
  );
}

function createOperationCaller(op: Operation, baseUrl: string, fetchImpl: typeof fetch, defaultHeaders: Record<string, string>) {
  return async (input: Record<string, unknown> = {}, options: CallOptions = {}) => {
    const routed = routeInput(op, input);
    const url = buildUrl(baseUrl, op.path, routed.path, routed.query);
    const init = buildRequestInit(op.method, mergeHeaders(defaultHeaders, options.headers), routed.body, options.signal);
    const res = await fetchImpl(url, init);
    const data = await parseResponseBody(res, op);
    if (!res.ok) {
      throw new ApiError(res.status, data, `${op.method.toUpperCase()} ${op.path} → ${res.status}`);
    }
    return data;
  };
}

type RoutedInput = {
  path: Record<string, Primitive>;
  query: Record<string, QueryValue>;
  body: unknown;
};

function routeInput(op: Operation, input: Record<string, unknown>): RoutedInput {
  const path: Record<string, Primitive> = {};
  const query: Record<string, QueryValue> = {};
  const bodyFields: Record<string, unknown> = {};

  const pathParams = new Set(op.pathParams ?? []);
  const queryParams = new Set(op.queryParams ?? []);

  for (const [key, value] of Object.entries(input)) {
    if (pathParams.has(key)) {
      path[key] = value as Primitive;
    } else if (queryParams.has(key)) {
      query[key] = value as QueryValue;
    } else if (op.hasBody) {
      bodyFields[key] = value;
    }
  }

  return {
    path,
    query,
    body: op.hasBody ? bodyFields : undefined
  };
}

function mergeHeaders(defaultHeaders: Record<string, string>, callHeaders: Record<string, string> | undefined): Record<string, string> {
  return {
    ...defaultHeaders,
    ...(callHeaders ?? {})
  };
}

function buildRequestInit(method: Operation["method"], headers: Record<string, string>, body: unknown, signal: AbortSignal | undefined): RequestInit {
  const finalHeaders = { ...headers };
  const init: RequestInit = {
    method: method.toUpperCase(),
    headers: finalHeaders,
    signal
  };
  if (body !== undefined) {
    if (!Object.keys(finalHeaders).some(key => key.toLowerCase() === "content-type")) {
      finalHeaders["content-type"] = "application/json";
    }
    init.body = JSON.stringify(body);
  }
  return init;
}

async function parseResponseBody(res: Response, op: Operation): Promise<unknown> {
  const raw = await res.text();
  if (raw.length === 0) {
    return null;
  }

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  const isJson = contentType.includes("application/json") || contentType.includes("+json");
  if (!isJson) {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch (cause) {
    if (res.ok) {
      throw new Error(`Invalid JSON response for ${op.method.toUpperCase()} ${op.path}`, { cause });
    }
    return raw;
  }
}
