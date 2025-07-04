import { useContext } from "react";

import type { DIContainer } from "@src/services/container/createContainer";
import { services as rootContainer } from "@src/services/http/http-browser.service";
import type { RootContainer } from "./ServicesContext";
import { ServicesContext } from "./ServicesContext";

type Props = {
  children: React.ReactNode;
  services?: Partial<RootContainer extends DIContainer<infer TFactories> ? TFactories : never>;
};

export const RootContainerProvider: React.FC<Props> = ({ children }) => {
  return <ServicesContext.Provider value={rootContainer}>{children}</ServicesContext.Provider>;
};

export function useRootContainer(): RootContainer {
  return useContext(ServicesContext);
}
