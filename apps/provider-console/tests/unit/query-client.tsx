import { QueryClientProvider } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";

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
  let wrapper = createWrapper(queryClient);
  const customWrapper = options?.wrapper;
  if (customWrapper) {
    const originalWrapper = wrapper;
    wrapper = props => customWrapper({ children: originalWrapper(props) });
  }

  return renderHook(hook, { wrapper });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export interface RenderAppHookOptions {
  wrapper?(props: { children: React.ReactNode }): JSX.Element;
}
