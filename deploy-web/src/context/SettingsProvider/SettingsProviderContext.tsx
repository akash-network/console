"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { queryClient } from "@src/queries";
import { mainnetId } from "@src/utils/constants";
import { useLocalStorage } from "@src/hooks/useLocalStorage";
import { initAppTypes } from "@src/utils/init";
import { NodeStatus } from "@src/types/node";
import { initiateNetworkData, networks } from "@src/store/networkStore";
import { migrateLocalStorage } from "@src/utils/localStorage";
import { mainnetNodes } from "@src/utils/apiUtils";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { z } from "zod";

export type BlockchainNode = {
  api: string;
  rpc: string;
  status: string;
  latency: number;
  nodeInfo: NodeStatus;
  id: string;
};

export type Settings = {
  apiEndpoint: string;
  rpcEndpoint: string;
  isCustomNode: boolean;
  nodes: Array<BlockchainNode>;
  selectedNode: BlockchainNode | null;
  customNode: BlockchainNode | null;
};

type ContextType = {
  settings: Settings;
  setSettings: (newSettings: Settings) => void;
  isLoadingSettings: boolean;
  isSettingsInit: boolean;
  refreshNodeStatuses: (settingsOverride?: Settings) => Promise<void>;
  isRefreshingNodeStatus: boolean;
  selectedNetworkId: string;
  setSelectedNetworkId: (value: React.SetStateAction<string>) => void;
};

const SettingsProviderContext = React.createContext<ContextType>({} as ContextType);

const defaultSettings: Settings = {
  apiEndpoint: "",
  rpcEndpoint: "",
  isCustomNode: false,
  nodes: [],
  selectedNode: null,
  customNode: null
};

const autoImportOrigin = "https://deploy.cloudmos.io";

export function SettingsProvider({ children }: React.PropsWithChildren<{}>) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSettingsInit, setIsSettingsInit] = useState(false);
  const [isRefreshingNodeStatus, setIsRefreshingNodeStatus] = useState(false);
  const { getLocalStorageItem, setLocalStorageItem } = useLocalStorage();
  const [selectedNetworkId, setSelectedNetworkId] = useState(mainnetId);
  const { isCustomNode, customNode, nodes, apiEndpoint } = settings;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  usePreviousRoute();

  useEffect(() => {
    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  async function handleMessage(ev: MessageEvent) {
    if (ev.origin !== autoImportOrigin) {
      console.log(`${window.location.origin} => Invalid origin ${ev.origin}`, ev);
      return;
    }

    console.log(`${window.location.origin} => Received event: `, ev);

    const importDataSchema = z.record(z.string(), z.string());

    const parsedData = await importDataSchema.safeParseAsync(ev.data);

    if (!parsedData.success) {
      console.error(`${window.location.origin} => Invalid data format`, parsedData.success);
      return;
    }

    const existingKeys = Object.keys(localStorage);
    const newKeys = Object.keys(parsedData.data).filter(key => !existingKeys.includes(key));

    for (const key of newKeys) {
      localStorage.setItem(key, parsedData.data[key]);
    }

    console.log(`${window.location.origin} => Imported ${newKeys.length} keys from ${ev.origin}`);
  }

  // load settings from localStorage or set default values
  useEffect(() => {
    const initiateSettings = async () => {
      setIsLoadingSettings(true);

      // Set the versions and metadata of available networks
      await initiateNetworkData();

      // Apply local storage migrations
      migrateLocalStorage();

      // Init app types based on the selected network id
      initAppTypes();

      const _selectedNetworkId = localStorage.getItem("selectedNetworkId") || mainnetId;

      setSelectedNetworkId(_selectedNetworkId);

      const settingsStr = getLocalStorageItem("settings");
      const settings = { ...defaultSettings, ...JSON.parse(settingsStr || "{}") };
      let defaultApiNode, defaultRpcNode, selectedNode;

      // Set the available nodes list and default endpoints
      const currentNetwork = networks.find(x => x.id === _selectedNetworkId);
      const response = await axios.get(currentNetwork?.nodesUrl || mainnetNodes);
      let nodes = response.data;

      const hasSettings =
        settingsStr && settings.apiEndpoint && settings.rpcEndpoint && settings.selectedNode && nodes.find(x => x.id === settings.selectedNode.id);

      // if user has settings locally
      if (hasSettings) {
        nodes = nodes.map(async node => {
          const nodeStatus = await loadNodeStatus(node.api);

          return {
            ...node,
            status: nodeStatus.status,
            latency: nodeStatus.latency,
            nodeInfo: nodeStatus.nodeInfo
          };
        });

        defaultApiNode = settings.apiEndpoint;
        defaultRpcNode = settings.rpcEndpoint;
        selectedNode = settings.selectedNode;

        let customNode;

        if (settings.isCustomNode) {
          const nodeStatus = await loadNodeStatus(settings.apiEndpoint);
          const customNodeUrl = new URL(settings.apiEndpoint);

          customNode = {
            status: nodeStatus.status,
            latency: nodeStatus.latency,
            nodeInfo: nodeStatus.nodeInfo,
            id: customNodeUrl.hostname
          };
        }

        updateSettings({ ...settings, apiEndpoint: defaultApiNode, rpcEndpoint: defaultRpcNode, selectedNode, customNode });
        setIsLoadingSettings(false);

        // update the node statuses asynchronously
        nodes = await Promise.all(nodes);

        updateSettings({ ...settings, nodes });
      } else {
        nodes = await Promise.all(
          nodes.map(async node => {
            const nodeStatus = await loadNodeStatus(node.api);

            return {
              ...node,
              status: nodeStatus.status,
              latency: nodeStatus.latency,
              nodeInfo: nodeStatus.nodeInfo
            };
          })
        );

        // Set fastest one as default
        const randomNode = getFastestNode(nodes);
        defaultApiNode = randomNode.api;
        defaultRpcNode = randomNode.rpc;
        selectedNode = randomNode;

        updateSettings({
          ...settings,
          apiEndpoint: defaultApiNode,
          rpcEndpoint: defaultRpcNode,
          selectedNode,
          nodes
        });
        setIsLoadingSettings(false);
      }

      setIsSettingsInit(true);
    };

    initiateSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Load the node status from node_info endpoint
   * @param {*} nodeUrl
   * @returns
   */
  const loadNodeStatus = async nodeUrl => {
    const start = performance.now();
    let latency,
      status = "",
      nodeInfo = {};

    try {
      const response = await axios.get(`${nodeUrl}/node_info`, { timeout: 10000 });
      nodeInfo = response.data;
      status = "active";
    } catch (error) {
      status = "inactive";
    } finally {
      const end = performance.now();
      latency = end - start;

      return {
        latency,
        status,
        nodeInfo
      };
    }
  };

  /**
   * Get the fastest node from the list based on latency
   * @param {*} nodes
   * @returns
   */
  const getFastestNode = nodes => {
    const filteredNodes = nodes.filter(n => n.status === "active");
    let lowest = Number.POSITIVE_INFINITY,
      fastestNode;

    // No active node, return the first one
    if (filteredNodes.length === 0) {
      return nodes[0];
    }

    filteredNodes.forEach(node => {
      if (node.latency < lowest) {
        lowest = node.latency;
        fastestNode = node;
      }
    });

    return fastestNode;
  };

  const updateSettings = newSettings => {
    setSettings(prevSettings => {
      clearQueries(prevSettings, newSettings);
      setLocalStorageItem("settings", JSON.stringify(newSettings));

      return newSettings;
    });
  };

  const clearQueries = (prevSettings, newSettings) => {
    if (prevSettings.apiEndpoint !== newSettings.apiEndpoint || (prevSettings.isCustomNode && !newSettings.isCustomNode)) {
      // Cancel and remove queries from cache if the api endpoint is changed
      queryClient.resetQueries();
      queryClient.cancelQueries();
      queryClient.removeQueries();
      queryClient.clear();
    }
  };

  /**
   * Refresh the nodes status and latency
   * @returns
   */
  const refreshNodeStatuses = useCallback(
    async (settingsOverride?) => {
      if (isRefreshingNodeStatus) return;

      setIsRefreshingNodeStatus(true);
      let _nodes = settingsOverride ? settingsOverride.nodes : nodes;
      let _customNode = settingsOverride ? settingsOverride.customNode : customNode;
      let _isCustomNode = settingsOverride ? settingsOverride.isCustomNode : isCustomNode;
      let _apiEndpoint = settingsOverride ? settingsOverride.apiEndpoint : apiEndpoint;

      if (_isCustomNode) {
        const nodeStatus = await loadNodeStatus(_apiEndpoint);
        const customNodeUrl = new URL(_apiEndpoint);

        _customNode = {
          status: nodeStatus.status,
          latency: nodeStatus.latency,
          nodeInfo: nodeStatus.nodeInfo,
          id: customNodeUrl.hostname
        };
      } else {
        _nodes = await Promise.all(
          _nodes.map(async node => {
            const nodeStatus = await loadNodeStatus(node.api);

            return {
              ...node,
              status: nodeStatus.status,
              latency: nodeStatus.latency,
              nodeInfo: nodeStatus.nodeInfo
            };
          })
        );
      }

      setIsRefreshingNodeStatus(false);

      // Update the settings with callback to avoid stale state settings
      setSettings(prevSettings => {
        const selectedNode = _nodes.find(node => node.id === prevSettings.selectedNode?.id);

        const newSettings = {
          ...prevSettings,
          nodes: _nodes,
          selectedNode,
          customNode: _customNode
        };

        clearQueries(prevSettings, newSettings);
        setLocalStorageItem("settings", JSON.stringify(newSettings));

        return newSettings;
      });
    },
    [isCustomNode, isRefreshingNodeStatus, customNode, setLocalStorageItem, apiEndpoint, nodes, setSettings]
  );

  return (
    <SettingsProviderContext.Provider
      value={{
        settings,
        setSettings: updateSettings,
        isLoadingSettings,
        refreshNodeStatuses,
        isRefreshingNodeStatus,
        selectedNetworkId,
        setSelectedNetworkId,
        isSettingsInit
      }}
    >
      {children}

      {/* iframe for localstorage automatic import */}
      {isSettingsInit && <iframe ref={iframeRef} className="hidden" src={`${autoImportOrigin}/standalone/localstorage-import`} width={0} height={0} />}
    </SettingsProviderContext.Provider>
  );
}

export const useSettings = () => {
  return { ...React.useContext(SettingsProviderContext) };
};
