# React Component Structure Guidelines

These guidelines help ensure maintainable, testable, and scalable React code.
They should be followed when contributing new components or refactoring existing ones.

---

## ✨ Core Principles

1. **Keep components small and focused**
   A component should do one thing. If it's hard to name, it's probably doing too much.

2. **Minimize hooks in the view layer**
   Use custom hooks or container components to isolate logic.

3. **Prefer composition over configuration**
   Avoid deeply nested components with complex props. Compose smaller units instead.

4. **Keep logic out of UI components**
   Views should be mostly dumb and receive props. Business logic and state should live in containers, hooks, or services.

---

## 🔹 Recommended Patterns

### 1. **Container Patterns**

We support two common patterns for containers:

#### A. Container + View

```tsx
// DeploymentDetail.container.tsx
export const DeploymentDetailContainer = () => {
  const { data, isLoading } = useDeploymentDetailQuery(address);
  return <DeploymentDetailView {...data} isLoading={isLoading} />;
};

// DeploymentDetail.view.tsx
export const DeploymentDetailView = ({ deployments, onSelect }: Props) => (
  <Tabs>
    <TabPanel title="Details">
      <DeploymentTable data={deployments} onSelect={onSelect} />
    </TabPanel>
  </Tabs>
);
```

#### B. Function-as-Children Container

```tsx
// NotificationChannelsListContainer.tsx
export const NotificationChannelsListContainer = ({ children }: {
  children: (props: {
    data: NotificationChannelsOutput;
    isLoading: boolean;
    refetch: () => void;
  }) => React.ReactNode;
}) => {
  const { data, isLoading, refetch } = useNotificationChannelsQuery();

  return <>{children({ data: data?.data ?? [], isLoading, refetch })}</>;
};
```

This pattern is useful when the consuming component needs fine-grained control over rendering but benefits from shared data-fetching and state logic.

---

### 2. **Hook Extracted for Logic**

```tsx
// useDeploymentDetailQuery.ts
import { useQuery } from '@tanstack/react-query';
import { getDeploymentDetails } from '../services/deploymentService';

export const useDeploymentDetailQuery = (address: string) => {
  return useQuery(['deploymentDetails', address], () => getDeploymentDetails(address));
};
```

### 3. **Service Layer Composition**

```ts
// deploymentService.ts
export async function getDeploymentDetails(address: string) {
  const deployment = await fetchDeployment(address);
  const leases = await fetchLeases(address);
  const provider = await fetchProvider(deployment.providerId);
  return { deployment, leases, provider };
}
```

> ✅ **Note:** Services should not be called directly from views. Use them inside custom hooks that encapsulate query logic.

---

### 4. **Isolate UI-Only Logic**

Some UI concerns are complex enough to deserve their own abstraction — especially if they involve:

* managing internal component state
* synchronizing with the URL
* memoization for performance
* persistence (e.g. localStorage)

A common example is tab management. Tabs should not live inside business logic containers or views tied to domain data. Extract this kind of behavior into a reusable hook or wrapper component:

```tsx
const { activeTab, setActiveTab } = useTabSync("deployment-detail");
```

Keeping UI-only logic separate prevents pollution of views and containers and improves readability, reusability, and testability.

---

## 🔧 Practical Tips

* Don’t hesitate to create multiple small components rather than one big one.
* If a component starts to have >200 lines or multiple responsibilities, split it.
* Use dependency injection (props, context) to keep testing simple.

---

## ✅ Summary Checklist

Use this checklist as a quick reference during implementation or review:

* [ ] Logic is extracted into hooks or services
* [ ] Component is small and focused
* [ ] Hooks in the view layer are minimal
* [ ] Component is easy to test
* [ ] Responsibilities are clearly separated
