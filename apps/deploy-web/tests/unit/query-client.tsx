import { QueryClientProvider } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";

import type { Props as ServicesProviderProps } from "@src/context/ServicesProvider";
import { ServicesProvider } from "@src/context/ServicesProvider";

import type { RenderHookResult } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

export function setupQuery<T>(hook: () => T, options?: RenderAppHookOptions): RenderHookResult<T, unknown> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false
      }
    }
  });
  let wrapper = createWrapper(queryClient, options?.services);
  const customWrapper = options?.wrapper;
  if (customWrapper) {
    const originalWrapper = wrapper;
    wrapper = props => customWrapper({ children: originalWrapper(props) });
  }

  return renderHook(hook, { wrapper });
}

function createWrapper(queryClient: QueryClient, services?: ServicesProviderProps["services"]) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ServicesProvider services={services}>{children}</ServicesProvider>
    </QueryClientProvider>
  );
}

export interface RenderAppHookOptions {
  services?: ServicesProviderProps["services"];
  wrapper?(props: { children: React.ReactNode }): JSX.Element;
}
