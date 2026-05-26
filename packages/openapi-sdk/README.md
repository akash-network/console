# @akashnetwork/openapi-sdk

Tiny, dependency-free runtime for typed OpenAPI clients. Pair it with an `operations` table (e.g. from `@akashnetwork/console-api-types`) and an OpenAPI `paths` type (from `openapi-typescript`) to get a fully typed `fetch`-based client with no codegen on the consumer side.

## Install

This is an internal workspace package. Add to a consumer's `package.json`:

```json
"@akashnetwork/openapi-sdk": "*"
```

## Usage

```ts
import { createApi, ApiError } from "@akashnetwork/openapi-sdk";
import { operations, type paths } from "@akashnetwork/console-api-types";

const api = createApi<paths, typeof operations>(operations, {
  baseUrl: "/api/proxy",                  // optional; "" by default (relative URL)
  fetch: customFetch,                     // optional; defaults to global fetch
  defaultHeaders: { "x-api-key": "..." }  // optional; merged into every request
});

// Fully typed: path/query/body fields inferred from `paths`, flat at the top level
const alerts = await api.v1.getAlerts({ page: 1, limit: 10 });
const alert = await api.v1.getAlert({ id: "abc" });
const channel = await api.v1.createNotificationChannel({
  data: { name: "Default", type: "email", config: { addresses: ["alice@example.com"] } }
});
```

`createApi` returns a `TypedClient<paths, operations>` — a tree of typed async functions, grouped by whatever `operations` table you pass in (the `console-api-types` table groups by URL version prefix).

## Errors

Non-2xx responses throw `ApiError`:

```ts
import { ApiError } from "@akashnetwork/openapi-sdk";

try {
  await api.v1.getAlert({ id: "missing" });
} catch (err) {
  if (err instanceof ApiError) {
    err.status; // number
    err.body;   // unknown — parsed JSON or text
    err.message; // e.g. "GET /v1/alerts/{id} → 404"
  }
}
```

## Public surface

```ts
function createApi<TPaths, TOps>(operations: TOps, config?: ClientConfig): TypedClient<TPaths, TOps>;

class ApiError extends Error { status: number; body: unknown }

type ClientConfig = {
  baseUrl?: string;
  fetch?: typeof fetch;
  defaultHeaders?: Record<string, string>;
};

type CallOptions = {
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

type TypedClient<TPaths, TOps>;
type Operation;
type OperationsTable;
```

## Pairing with React Query

The runtime returns plain async functions. To get a tree of `useQuery`/`useMutation` hooks, wrap with `@akashnetwork/react-query-proxy`:

```ts
import { createApi } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { operations, type paths } from "@akashnetwork/console-api-types";

const api = createApi<paths, typeof operations>(operations, { baseUrl: "/api/proxy" });
const apiHooks = createProxy(api);

// In a React component:
const { data, isLoading } = apiHooks.v1.getAlerts.useQuery({ page: 1 });

// Direct (non-hook) calls still work — the proxy keeps each operation node callable:
const alerts = await apiHooks.v1.getAlerts({ page: 1 });
```

## Implementation notes

- **No dependencies.** The runtime uses native `fetch` and JS `Proxy`. The whole package is ~150 lines.
- **Symbol-safe proxies.** Accessing unknown string keys, symbols (`Symbol.iterator`, `Symbol.toPrimitive`), and notably `then` returns `undefined` — so an operation node and the client itself are not thenable, and accidental `await client.v1` resolves to the proxy itself instead of throwing.
- **JSON in, JSON out by default.** Bodies are `JSON.stringify`'d when present; responses are parsed as JSON when the response `content-type` includes `application/json` (including `+json` subtypes), otherwise read as text. Empty bodies (e.g. 204 No Content) come back as `null`.
- **`AbortSignal` is forwarded** to the underlying `fetch` call via `options.signal`.
- **Headers are merged** in this order: `defaultHeaders` from `ClientConfig`, then per-call `options.headers`. Later entries win. The implicit `content-type: application/json` is added only when a body is sent and the caller hasn't supplied a `content-type` already.
