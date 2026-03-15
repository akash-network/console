# Frontend Testing Patterns (deploy-web)

## Table of Contents
1. [DEPENDENCIES / COMPONENTS Pattern](#dependencies--components-pattern)
2. [MockComponents Utility](#mockcomponents-utility)
3. [Hook Testing](#hook-testing)
4. [Query Hook Testing](#query-hook-testing)
5. [Container Component Testing](#container-component-testing)
6. [Service Testing](#service-testing)
7. [queryBy vs getBy](#queryby-vs-getby)
8. [Snapshot Testing](#snapshot-testing)

## DEPENDENCIES / COMPONENTS Pattern

This is the canonical pattern for testing React components without `vi.mock()`. Components export their heavy dependencies and accept them as a prop for test injection.

### Source-side

```typescript
// MyComponent.tsx
import { useRouter } from "next/navigation";
import { CustomTooltip } from "../CustomTooltip";
import { LabelValue } from "../LabelValue";
import { useSettings } from "@src/hooks/useSettings";

export const COMPONENTS = { CustomTooltip, LabelValue };
// or for hooks/services:
export const DEPENDENCIES = { useRouter, useSettings };

interface Props {
  title: string;
  components?: typeof COMPONENTS;
  dependencies?: typeof DEPENDENCIES;
}

export function MyComponent({ title, components = COMPONENTS, dependencies = DEPENDENCIES }: Props) {
  const { CustomTooltip, LabelValue } = components;
  const { useRouter, useSettings } = dependencies;
  // ... use them normally
}
```

### Test-side

```typescript
import { COMPONENTS, MyComponent } from "./MyComponent";
import { MockComponents } from "@tests/unit/mocks";

describe(MyComponent.name, () => {
  it("renders title", () => {
    setup({ title: "Hello" });
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("uses custom tooltip", () => {
    const CustomTooltip = vi.fn(() => <div>tooltip</div>);
    setup({ title: "Test", components: { CustomTooltip } });
    expect(CustomTooltip).toHaveBeenCalled();
  });

  function setup(input: { title: string; components?: Partial<typeof COMPONENTS> }) {
    return render(
      <MyComponent
        title={input.title}
        components={MockComponents(COMPONENTS, input.components)}
      />
    );
  }
});
```

**Important distinction**: Services should be injected via `useServices` hook (DI container), NOT via the `DEPENDENCIES` prop. The `DEPENDENCIES` prop is for components and hooks only.

## MockComponents Utility

Located at `apps/deploy-web/tests/unit/mocks.tsx`:

```typescript
export function MockComponents<T extends Record<string, any>>(
  components: T,
  overrides?: Partial<T>
): Mocked<T> {
  return Object.keys(components).reduce((all, name: keyof T) => {
    all[name] = overrides?.[name] ||
      (vi.fn(typeof name === "string" && name.startsWith("use")
        ? undefined
        : ComponentMock) as T[keyof T]);
    return all;
  }, {} as T);
}
```

This auto-mocks:
- Components as pass-through `<>{children}</>` renderers
- Hooks (names starting with `use`) as `vi.fn()` returning `undefined`
- Overrides replace specific dependencies

There's also a `ComponentMock` helper for simpler cases.

## Hook Testing

Use `renderHook` from `@testing-library/react`. Inject dependencies directly.

```typescript
import { renderHook } from "@testing-library/react";

describe(useDeployButtonFlow.name, () => {
  it("returns deploy action when template param exists", () => {
    const { result } = setup({ templateId: "abc123" });
    expect(result.current.action).toBe("deploy");
  });

  function setup(searchParams: Record<string, string | null>) {
    const params = createSearchParams(searchParams);
    const useSearchParams = () => params as ReadonlyURLSearchParams;
    return renderHook(() =>
      useDeployButtonFlow({
        dependencies: { useSearchParams, window: mockWindow }
      })
    );
  }
});
```

Simple hooks without dependencies:

```typescript
const { result } = renderHook(() => useCurrencyFormatter());
expect(result.current(1234.56)).toBe("$1,234.56");
```

## Query Hook Testing

Use the `setupQuery` utility from `apps/deploy-web/tests/unit/query-client.tsx`. It wraps `renderHook` with `TestContainerProvider` containing a `QueryClient` and mock services.

```typescript
import { setupQuery } from "@tests/unit/query-client";
import { mock } from "vitest-mock-extended";

describe(usePaymentMethodsQuery.name, () => {
  it("returns payment methods on success", async () => {
    const stripeService = mock<StripeService>({
      getPaymentMethods: vi.fn().mockResolvedValue(mockMethods)
    });

    const { result } = setupQuery(
      () => usePaymentMethodsQuery(),
      { services: { stripe: () => stripeService } }
    );

    await vi.waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(mockMethods);
  });
});
```

## Container Component Testing

For render-prop / children-as-function containers, use `createContainerTestingChildCapturer` from `apps/deploy-web/tests/unit/container-testing-child-capturer.tsx`.

```typescript
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

describe(BillingContainer.name, () => {
  it("passes transaction data to children", async () => {
    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
      <BillingContainer dependencies={dependencies}>
        {props => childCapturer.renderChild({ ...props })}
      </BillingContainer>
    );

    const child = await childCapturer.awaitChild(() => true);
    expect(child.data).toEqual(expectedTransactions);
  });
});
```

## Service Testing

Frontend services are tested by constructing them directly with mocked dependencies:

```typescript
describe(FeatureFlagService.name, () => {
  it("returns all flags enabled when enableAll is true", async () => {
    const { service } = setup({ enableAll: true });
    const flags = await service.getFlags();
    expect(flags.every(f => f.enabled)).toBe(true);
  });

  function setup(options?: { enableAll?: boolean }) {
    const unleash = mock<typeof unleashModule>();
    const config = { NEXT_PUBLIC_UNLEASH_ENABLE_ALL: options?.enableAll ?? false } as ServerEnvConfig;
    const service = new FeatureFlagService(unleash, config);
    return { service, unleash };
  }
});
```

## queryBy vs getBy

In frontend test expectations:
- Use `getBy*` for presence assertions
- Use `queryBy*` for absence assertions

- `getBy*` throws if missing and prints useful DOM context (better for debugging presence failures)
- `queryBy*` returns `null`, which is ideal for absence checks

```typescript
// Good
expect(screen.getByText("John Doe")).toBeInTheDocument();
expect(screen.queryByText("Admin")).not.toBeInTheDocument();

// Bad
expect(screen.queryByText("John Doe")).toBeInTheDocument();
```

## Snapshot Testing

Use snapshot testing only for pure presentational (View-only) components with no logic. This is rare — most components have some behavior worth testing explicitly.

```typescript
it("matches snapshot", () => {
  const { container } = setup({ variant: "primary" });
  expect(container).toMatchSnapshot();
});
```
