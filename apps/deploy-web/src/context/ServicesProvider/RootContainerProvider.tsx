import { useContext } from "react";

import { services as rootContainer } from "@src/services/app-di-container/browser-di-container";
import { createChildContainer, type DIContainer } from "@src/services/container/createContainer";
import type { RootContainer } from "./ServicesContext";
import { ServicesContext } from "./ServicesContext";

type Props = {
  children: React.ReactNode;
  services?: Partial<RootContainer extends DIContainer<infer TFactories> ? TFactories : never>;
};

export const RootContainerProvider: React.FC<Props> = ({ children, services }) => {
  const container = services ? createChildContainer(rootContainer, services) : rootContainer;
  return <ServicesContext.Provider value={container}>{children}</ServicesContext.Provider>;
};

export function useRootContainer(): RootContainer {
  return useContext(ServicesContext);
}
