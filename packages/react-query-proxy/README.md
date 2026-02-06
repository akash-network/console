# React Query Proxy

> Wrap any async service into fully-typed TanStack React Query hooks at runtime.
> Works with REST, gRPC, XML-RPC, generated clients, or hand-written APIs — no codegen required.

---

## ✨ Why?

Most teams already have an API client / SDK:
- generated from OpenAPI / gRPC
- written by hand
- shared between frontend, backend, scripts, and tests

This library lets you **reuse that SDK directly in React** by turning it into:
- `useQuery` hooks
- `useMutation` hooks
- stable, predictable query keys

All **at runtime**, without generating code or schemas.

---

## 📦 Installation

```bash
npm install @akashnetwork/react-query-proxy
```

> Peer dependencies:
> - `react >= 18`
> - `@tanstack/react-query >= 5`

---

## 🚀 Basic usage

### 1. Start with a plain async SDK

```ts
const sdk = {
  alerts: {
    async list(input?: { page?: number }) {
      return fetchAlerts(input)
    },

    async create(input: { name: string }) {
      return createAlert(input)
    },
  },
}
```

---

### 2. Wrap it with `createProxy`

```ts
import { createProxy } from '@akashnetwork/react-query-proxy'

export const api = createProxy(sdk)
```

---

### 3. Use queries

```tsx
function AlertsList() {
  const q = api.alerts.list.useQuery({ page: 1 })

  if (q.isLoading) return <div>Loading…</div>
  if (q.isError) return <div>Error</div>

  return <pre>{JSON.stringify(q.data, null, 2)}</pre>
}
```

---

### 4. Use mutations

```tsx
function CreateAlert() {
  const m = api.alerts.create.useMutation()

  return (
    <button onClick={() => m.mutate({ name: 'CPU High' })} disabled={m.isPending}>
      Create
    </button>
  )
}
```

---

## 🔑 Query keys & invalidation

```ts
api.alerts.list.getKey({ page: 1 })
// → ['alerts', 'list', { page: 1 }]
```

## 📄 License

Apache 2.0
