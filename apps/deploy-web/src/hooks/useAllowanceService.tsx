import { useMemo } from "react";
import { AllowanceHttpService } from "@akashnetwork/http-sdk";

import { useSettings } from "@src/context/SettingsProvider";

export const useAllowanceService = () => {
  const { settings } = useSettings();
  return useMemo(() => new AllowanceHttpService({ baseURL: settings.apiEndpoint }), [settings.apiEndpoint]);
};
