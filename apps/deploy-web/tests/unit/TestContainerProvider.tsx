import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { Props as ServicesProviderProps } from "@src/context/ServicesProvider/ServicesProvider";
import { ServicesProvider, useServices } from "@src/context/ServicesProvider/ServicesProvider";

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
  const testServices = {
    queryClient: () => queryClient,
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
