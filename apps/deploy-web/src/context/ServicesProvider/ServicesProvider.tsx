import React, { useContext, useMemo } from "react";
import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { requestFn } from "@openapi-qraft/react";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useUser } from "@src/hooks/useUser";
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

export const ServicesProvider: React.FC<{ children: React.ReactNode; services?: Partial<typeof defaultServices> }> = ({
  children,
  services: providedServices
}) => {
  const user = useUser();
  const services = useMemo(() => {
    // TODO: remove this once auth proxy for notifications is implemented.
    //  This implementation is temporal for development purposes
    //  Issue: https://github.com/akash-network/console/issues/1350
    const notificationsApi = user
      ? createAPIClient({
          requestFn(schema, requestInfo) {
            return requestFn(schema, {
              ...requestInfo,
              headers: {
                ...requestInfo.headers,
                "x-user-id": user.id
              }
            });
          },
          baseUrl: browserEnvConfig.NEXT_PUBLIC_NOTIFICATIONS_API_BASE_URL,
          queryClient
        })
      : defaultServices.notificationsApi;

    return {
      ...defaultServices,
      notificationsApi,
      ...providedServices
    };
  }, [providedServices, user]);

  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
};

export function useServices() {
  return useContext(ServicesContext);
}
