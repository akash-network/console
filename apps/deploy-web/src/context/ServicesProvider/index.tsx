import React, { useContext } from "react";

import { services as defaultServices } from "@src/services/http/http-browser.service";

const ServicesContext = React.createContext(defaultServices);

export const ServicesProvider: React.FC<{ children: React.ReactNode; services?: Partial<typeof defaultServices> }> = ({ children, services }) => {
  return <ServicesContext.Provider value={{ ...defaultServices, ...services }}>{children}</ServicesContext.Provider>;
};

export function useServices() {
  return useContext(ServicesContext);
}
