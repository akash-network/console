## Use `mock<T>()` instead of `as unknown as <Type>` in tests

## Description
- Build test doubles with `mock<T>()` from `vitest-mock-extended` rather than hand-rolled object literals coerced via `as unknown as <Type>`
- `mock<T>()` stays in sync with the real type: if a field is added or renamed upstream, the mock keeps satisfying the contract automatically (or surfaces a real type error). Hand-built `as unknown as` doubles silently keep compiling with stale fields and hide contract regressions
- Override only the fields the test cares about; let `mock<T>()` provide auto-mocked fns/values for everything else
- For hook return values, use `mock<ReturnType<typeof THook>>({ ... })` (or `mock<typeof DEPENDENCIES.useX extends () => infer R ? R : never>(...)` if the type alias is not exported)
- Reserve `as unknown as` for the rare case where the type is structurally incompatible (e.g. branded types) and `mock<T>()` cannot help

## Examples

### Good
```typescript
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./AccountMenu";

const useCustomUser: typeof DEPENDENCIES.useCustomUser = () =>
  mock<ReturnType<typeof DEPENDENCIES.useCustomUser>>({
    user: input.username ? { username: input.username, userId: input.userId } : null,
    isLoading: input.isLoading ?? false
  });

const useRouter: typeof DEPENDENCIES.useRouter = () =>
  mock<ReturnType<typeof DEPENDENCIES.useRouter>>({ push });
```

```typescript
const stripeService = mock<StripeService>({
  getPaymentMethods: vi.fn().mockResolvedValue(mockMethods)
});
```

### Bad
```typescript
// Hand-built object coerced through `as unknown as` — drift-prone
const useCustomUser = () =>
  ({
    user: input.username ? { username: input.username } : null,
    isLoading: input.isLoading ?? false
  }) as unknown as ReturnType<typeof DEPENDENCIES.useCustomUser>;

// If `UseCustomUser` later adds a required field, this still compiles silently.
```

```typescript
// Forces every consumer to know the full shape, even fields the test ignores
const stripeService = {
  getPaymentMethods: vi.fn().mockResolvedValue(mockMethods),
  createPaymentMethod: vi.fn(),
  deletePaymentMethod: vi.fn(),
  // ...all other methods listed only to satisfy the type
} as unknown as StripeService;
```
