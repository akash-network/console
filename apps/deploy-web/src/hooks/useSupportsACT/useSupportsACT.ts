import { useSettings as useSettingsOriginal } from "@src/context/SettingsProvider";
import { compareVersions } from "@src/utils/semver";

export function useSupportsACT(options?: { dependencies?: { useSettings: typeof useSettingsOriginal } }): boolean {
  const { useSettings } = { useSettings: useSettingsOriginal, ...options?.dependencies };
  const { settings } = useSettings();
  const appVersion = settings.selectedNode?.appVersion;
  return !!appVersion && compareVersions(appVersion, "2.0.0") >= 0;
}
