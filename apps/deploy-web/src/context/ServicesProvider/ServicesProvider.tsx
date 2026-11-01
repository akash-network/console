import React, { useContext, useMemo } from "react";

import { services as rootContainer } from "@src/services/app-di-container/browser-di-container";
import type { DIContainer } from "@src/services/container/createContainer";
import { createChildContainer } from "@src/services/container/createContainer";
import type { RootContainer } from "./ServicesContext";
import { ServicesContext } from "./ServicesContext";

export type Props = {
  children: React.ReactNode;
  services?: Partial<AppDIContainer extends DIContainer<infer TFactories> ? TFactories : never>;
};

export type AppDIContainer = RootContainer;

export const ServicesProvider: React.FC<Props> = ({ children, services }) => {
  const container = useMemo(() => (services ? createChildContainer(rootContainer, services) : rootContainer), [services]);

  return <ServicesContext.Provider value={container}>{children}</ServicesContext.Provider>;
};

export function useServices(): AppDIContainer {
  return useContext(ServicesContext);
}
