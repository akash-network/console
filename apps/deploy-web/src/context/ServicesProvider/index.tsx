import React, { useContext } from "react";
import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { requestFn } from "@openapi-qraft/react";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { queryClient } from "@src/queries/queryClient";
import { browserApiUrlService } from "@src/services/api-url/browser-api-url.service";
import { services as httpServices } from "@src/services/http/http-browser.service";

const defaultServices = {
  ...httpServices,
  browserApiUrlService,
  notificationsApi: createAPIClient({
    requestFn,
    baseUrl: browserEnvConfig.NEXT_PUBLIC_NOTIFICATIONS_API_BASE_URL,
    queryClient
  })
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
