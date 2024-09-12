"use client";
import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";

import { useLocalStorage } from "@src/hooks/useLocalStorage";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { queryClient } from "@src/queries";
import networkStore, { initiateNetworkVersions } from "@src/store/networkStore";
import type { FCWithChildren } from "@src/types/component";
import { NodeStatus } from "@src/types/node";
import { initAppTypes } from "@src/utils/init";
import { migrateLocalStorage } from "@src/utils/localStorage";

export type BlockchainNode = {
  api: string;
  rpc: string;
  status: string;
  latency: number;
  nodeInfo: NodeStatus | null;
  id: string;
};

export type Settings = {
  apiEndpoint: string;
  rpcEndpoint: string;
  isCustomNode: boolean;
  nodes: Array<BlockchainNode>;
  selectedNode: BlockchainNode | null | undefined;
  customNode: BlockchainNode | null | undefined;
};

type ContextType = {
  settings: Settings;
  setSettings: (newSettings: Settings) => void;
  isLoadingSettings: boolean;
  isSettingsInit: boolean;
  refreshNodeStatuses: (settingsOverride?: Settings) => Promise<void>;
  isRefreshingNodeStatus: boolean;
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

export const SettingsProvider: FCWithChildren = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSettingsInit, setIsSettingsInit] = useState(false);
  const [isRefreshingNodeStatus, setIsRefreshingNodeStatus] = useState(false);
  const { getLocalStorageItem, setLocalStorageItem } = useLocalStorage();
  const { isCustomNode, customNode, nodes, apiEndpoint, rpcEndpoint } = settings;
  const selectedNetwork = networkStore.useSelectedNetwork();

  usePreviousRoute();

  // load settings from localStorage or set default values
  useEffect(() => {
    const initiateSettings = async () => {
      setIsLoadingSettings(true);

      await initiateNetworkVersions();

      // Apply local storage migrations
      migrateLocalStorage();

      // Init app types based on the selected network id
      initAppTypes();

      const settingsStr = getLocalStorageItem("settings");
      const settings = { ...defaultSettings, ...JSON.parse(settingsStr || "{}") } as Settings;

      const { data: nodes } = await axios.get<Array<{ id: string; api: string; rpc: string }>>(selectedNetwork.nodesUrl);
      const nodesWithStatuses: Array<BlockchainNode> = await Promise.all(
        nodes.map(async node => {
          const nodeStatus = await loadNodeStatus(node.rpc);

          return {
            ...node,
            status: nodeStatus.status,
            latency: nodeStatus.latency,
            nodeInfo: nodeStatus.nodeInfo
          };
        })
      );

      const hasSettings =
        settingsStr && settings.apiEndpoint && settings.rpcEndpoint && settings.selectedNode && nodes?.find(x => x.id === settings.selectedNode?.id);
      let defaultApiNode = hasSettings ?? settings.apiEndpoint;
      let defaultRpcNode = hasSettings ?? settings.rpcEndpoint;
      let selectedNode = hasSettings ?? settings.selectedNode;

      // If the user has a custom node set, use it no matter the status
      if (hasSettings && settings.isCustomNode) {
        const nodeStatus = await loadNodeStatus(settings.rpcEndpoint);
        const customNodeUrl = new URL(settings.apiEndpoint);

        const customNode: Partial<BlockchainNode> = {
          status: nodeStatus.status,
          latency: nodeStatus.latency,
          nodeInfo: nodeStatus.nodeInfo,
          id: customNodeUrl.hostname
        };

        updateSettings({ ...settings, apiEndpoint: defaultApiNode, rpcEndpoint: defaultRpcNode, selectedNode, customNode, nodes: nodesWithStatuses });
      }

      // If the user has no settings or the selected node is inactive, use the fastest available active node
      if (!hasSettings || (hasSettings && settings.selectedNode?.status === "inactive")) {
        const randomNode = getFastestNode(nodesWithStatuses);
        // Use cosmos.directory as a backup if there's no active nodes in the list
        defaultApiNode = randomNode?.api || "https://rest.cosmos.directory/akash";
        defaultRpcNode = randomNode?.rpc || "https://rpc.cosmos.directory/akash";
        selectedNode = randomNode || {
          api: defaultApiNode,
          rpc: defaultRpcNode,
          status: "active",
          latency: 0,
          nodeInfo: null,
          id: "https://rest.cosmos.directory/akash"
        };
        updateSettings({ ...settings, apiEndpoint: defaultApiNode, rpcEndpoint: defaultRpcNode, selectedNode, nodes: nodesWithStatuses });
      } else {
        defaultApiNode = settings.apiEndpoint;
        defaultRpcNode = settings.rpcEndpoint;
        selectedNode = settings.selectedNode;
        updateSettings({ ...settings, apiEndpoint: defaultApiNode, rpcEndpoint: defaultRpcNode, selectedNode, nodes: nodesWithStatuses });
      }

      setIsLoadingSettings(false);
      setIsSettingsInit(true);
    };

    initiateSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Load the node status from status rpc endpoint
   * @param {string} rpcUrl
   * @returns
   */
  const loadNodeStatus = async (rpcUrl: string) => {
    const start = performance.now();
    let status: "active" | "inactive" = "inactive";
    let nodeStatus: NodeStatus | null = null;

    try {
      const response = await axios.get(`${rpcUrl}/status`, { timeout: 10000 });
      nodeStatus = response.data.result as NodeStatus;
      status = "active";
    } catch (error) {
      status = "inactive";
    }

    const end = performance.now();
    const latency = end - start;

    return {
      latency,
      status,
      nodeInfo: nodeStatus
    };
  };

  /**
   * Get the fastest node from the list based on latency
   * @param {*} nodes
   * @returns
   */
  const getFastestNode = (nodes: Array<BlockchainNode>) => {
    const filteredNodes = nodes.filter(n => n.status === "active" && n.nodeInfo?.sync_info.catching_up === false);
    let lowest = Number.POSITIVE_INFINITY,
      fastestNode: BlockchainNode | null = null;

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
    async (settingsOverride?: Settings) => {
      if (isRefreshingNodeStatus) return;

      setIsRefreshingNodeStatus(true);
      let _nodes = settingsOverride ? settingsOverride.nodes : nodes;
      let _customNode = settingsOverride ? settingsOverride.customNode : customNode;
      const _isCustomNode = settingsOverride ? settingsOverride.isCustomNode : isCustomNode;
      const _apiEndpoint = settingsOverride ? settingsOverride.apiEndpoint : apiEndpoint;
      const _rpcEndpoint = settingsOverride ? settingsOverride.rpcEndpoint : rpcEndpoint;

      if (_isCustomNode) {
        const nodeStatus = await loadNodeStatus(_rpcEndpoint);
        const customNodeUrl = new URL(_apiEndpoint);

        _customNode = {
          status: nodeStatus.status,
          latency: nodeStatus.latency,
          nodeInfo: nodeStatus.nodeInfo,
          id: customNodeUrl.hostname,
          api: _apiEndpoint,
          rpc: _rpcEndpoint
        };
      } else {
        _nodes = await Promise.all(
          _nodes.map(async node => {
            const nodeStatus = await loadNodeStatus(node.rpc);

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
        isSettingsInit
      }}
    >
      {children}
    </SettingsProviderContext.Provider>
  );
};

export const useSettings = () => {
  return { ...React.useContext(SettingsProviderContext) };
};
