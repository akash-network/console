import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { RemoteConfig } from "@src/services/config/config.service";

export function useAppConfig(options?: AppConfigOptions): RemoteConfig | undefined {
  const di = useServices();
  const { data } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => di.config.getConfig(),
    gcTime: Infinity,
    ...options
  });

  return data;
}

export interface AppConfigOptions {
  enabled?: boolean;
}
