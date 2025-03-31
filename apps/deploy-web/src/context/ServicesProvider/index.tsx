import React, { useContext } from "react";

import { browserApiUrlService } from "@src/services/api-url/browser-api-url.service";
import { services as httpServices } from "@src/services/http/http-browser.service";

const defaultServices = {
  ...httpServices,
  browserApiUrlService
};

const ServicesContext = React.createContext(defaultServices);

export const ServicesProvider: React.FC<{ children: React.ReactNode; services?: Partial<typeof defaultServices> }> = ({ children, services }) => {
  return (
    <ServicesContext.Provider
      value={{
        ...defaultServices,
        ...services
      }}
    >
      {children}
    </ServicesContext.Provider>
  );
};

export function useServices() {
  return useContext(ServicesContext);
}
