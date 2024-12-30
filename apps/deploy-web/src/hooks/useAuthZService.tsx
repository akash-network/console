import { useMemo } from "react";
import { AuthzHttpService } from "@akashnetwork/http-sdk";

import { useSettings } from "@src/context/SettingsProvider";

export const useAuthZService = () => {
  const { settings } = useSettings();
  return useMemo(() => new AuthzHttpService({ baseURL: settings.apiEndpoint }), [settings.apiEndpoint]);
};
