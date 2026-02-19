import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { NextRouter } from "next/router";
import { mock } from "vitest-mock-extended";

import type { Props as ServicesProviderProps } from "@src/context/ServicesProvider/ServicesProvider";
import { ServicesProvider, useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { UrlService } from "@src/utils/urlUtils";

export const TestContainerProvider: React.FC<ServicesProviderProps> = ({ children, services }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false
      }
    }
  });
  const router = mock<NextRouter>();
  const testServices = {
    queryClient: () => queryClient,
    urlService: () => UrlService,
    router: () => router,
    ...services
  };

  return (
    <ServicesProvider services={testServices}>
      <QueryProviderFromDI>{children}</QueryProviderFromDI>
    </ServicesProvider>
  );
};

function QueryProviderFromDI({ children }: { children: React.ReactNode }) {
  const { queryClient } = useServices();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
