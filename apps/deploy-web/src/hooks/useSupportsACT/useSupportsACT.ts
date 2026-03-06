import { useSettings } from "@src/context/SettingsProvider";

export function useSupportsACT(): boolean {
  const { settings } = useSettings();
  const nodeInfo = settings.selectedNode?.nodeInfo?.node_info;
  return nodeInfo?.network === "testnet-8";
}
