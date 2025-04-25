import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@src/queries/queryClient";

import { renderHook } from "@testing-library/react";

queryClient.setDefaultOptions({
  queries: {
    retry: false
  }
});

const wrapper = ({ children }: { children: React.ReactNode }) => {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

export const setupQuery = (hook: () => any) => {
  return renderHook(hook, { wrapper });
};
