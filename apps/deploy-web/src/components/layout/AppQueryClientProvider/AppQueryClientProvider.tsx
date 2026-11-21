import type { FC, ReactNode } from "react";
import { useState } from "react";
import type { DehydratedState } from "@tanstack/react-query";
import { HydrationBoundary, QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useRootContainer } from "@src/context/ServicesProvider/RootContainerProvider";

const useIsServerRender = () => typeof window === "undefined";

export const DEPENDENCIES = {
  useRootContainer,
  useIsServerRender
};

interface Props {
  /** The queries a server render read for the page, so the browser's first render already holds them. */
  dehydratedState?: DehydratedState;
  children: ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

/** A server render gets a query cache of its own, because the app's cache lives as long as the process and would hand one request's data to the next. */
export const AppQueryClientProvider: FC<Props> = ({ dehydratedState, children, dependencies: d = DEPENDENCIES }) => {
  const { queryClient: appQueryClient } = d.useRootContainer();
  const isServerRender = d.useIsServerRender();
  const [queryClient] = useState(() => (isServerRender ? new QueryClient() : appQueryClient));

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>{children}</HydrationBoundary>
    </QueryClientProvider>
  );
};
