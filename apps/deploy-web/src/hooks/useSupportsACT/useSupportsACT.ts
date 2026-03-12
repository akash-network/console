import { useSettings as useSettingsOriginal } from "@src/context/SettingsProvider";

export function useSupportsACT(options?: { dependencies?: { useSettings: typeof useSettingsOriginal } }): boolean {
  const { useSettings } = { useSettings: useSettingsOriginal, ...options?.dependencies };
  const { settings } = useSettings();
  const nodeInfo = settings.selectedNode?.nodeInfo?.node_info;
  return !!nodeInfo && ["testnet-8", "testnet-oracle"].includes(nodeInfo.network);
}
