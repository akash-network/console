import { useSettings } from "@src/context/SettingsProvider";
import { compareVersions } from "@src/utils/semver";

const DEPENDENCIES = { useSettings };
interface HookInput {
  dependencies?: typeof DEPENDENCIES;
}

export function useSupportsACT({ dependencies: d = DEPENDENCIES }: HookInput = { dependencies: DEPENDENCIES }): boolean {
  const { settings } = d.useSettings();
  const chainNode = settings.isCustomNode ? settings.customNode : settings.selectedNode;
  const appVersion = chainNode?.appVersion;
  return !!appVersion && compareVersions(appVersion, "2.0.0") >= 0;
}
