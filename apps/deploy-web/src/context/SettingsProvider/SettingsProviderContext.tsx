"use client";
import React, { useCallback, useEffect, useState } from "react";
import { netConfig } from "@akashnetwork/net";

import { useLocalStorage } from "@src/hooks/useLocalStorage";
import { usePreviousRoute } from "@src/hooks/usePreviousRoute";
import { createFetchAdapter } from "@src/services/createFetchAdapter/createFetchAdapter";
import type { FCWithChildren } from "@src/types/component";
import type { NodeStatus } from "@src/types/node";
import { migrateLocalStorage } from "@src/utils/localStorage";
import { useRootContainer } from "../ServicesProvider/RootContainerProvider";

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
  isBlockchainDown: boolean;
};

type ContextType = {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  isLoadingSettings: boolean;
  isSettingsInit: boolean;
  refreshNodeStatuses: (settingsOverride?: Settings) => Promise<void>;
  isRefreshingNodeStatus: boolean;
};

export type SettingsContextType = ContextType;

export const SettingsProviderContext = React.createContext<ContextType>({} as ContextType);

const defaultSettings: Settings = {
  apiEndpoint: "",
  rpcEndpoint: "",
  isCustomNode: false,
  nodes: [],
  selectedNode: null,
  customNode: null,
  isBlockchainDown: false
};

const fetchAdapter = createFetchAdapter({
  circuitBreaker: {
    halfOpenAfter: 5 * 1000
  }
});

export const SettingsProvider: FCWithChildren = ({ children }) => {
  const { externalApiHttpClient, queryClient, networkStore } = useRootContainer();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSettingsInit, setIsSettingsInit] = useState(false);
  const [isRefreshingNodeStatus, setIsRefreshingNodeStatus] = useState(false);
  const { getLocalStorageItem, setLocalStorageItem } = useLocalStorage();
  const { isCustomNode, customNode, nodes, apiEndpoint, rpcEndpoint } = settings;
  const selectedNetwork = networkStore.useSelectedNetwork();
  const [{ isLoading: isLoadingNetworks }] = networkStore.useNetworksStore();

  usePreviousRoute();

  // load settings from localStorage or set default values
  useEffect(() => {
    if (isLoadingNetworks) {
      return;
    }

    const initiateSettings = async () => {
      setIsLoadingSettings(true);

      // Apply local storage migrations
      migrateLocalStorage();

      const settingsStr = getLocalStorageItem("settings");
      const settings = { ...defaultSettings, ...JSON.parse(settingsStr || "{}") } as Settings;

      const { data: nodes } = await externalApiHttpClient.get<Array<{ id: string; api: string; rpc: string }>>(selectedNetwork.nodesUrl);
      const nodesWithStatuses: BlockchainNode[] = await Promise.all(
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

      const selectedNodeInSettings =
        settingsStr && settings.apiEndpoint && settings.rpcEndpoint && settings.selectedNode ? nodes?.find(x => x.id === settings.selectedNode?.id) : undefined;
      let defaultApiNode = selectedNodeInSettings?.api ?? settings.apiEndpoint;
      let defaultRpcNode = selectedNodeInSettings?.rpc ?? settings.rpcEndpoint;
      let selectedNode = selectedNodeInSettings || settings.selectedNode;

      // If the user has a custom node set, use it no matter the status
      if (settings.isCustomNode) {
        const nodeStatus = await loadNodeStatus(settings.rpcEndpoint);
        const customNodeUrl = new URL(settings.apiEndpoint);

        const customNode: BlockchainNode = {
          api: "",
          rpc: "",
          status: nodeStatus.status,
          latency: nodeStatus.latency,
          nodeInfo: nodeStatus.nodeInfo,
          id: customNodeUrl.hostname
        };

        updateSettings({
          ...settings,
          apiEndpoint: defaultApiNode,
          rpcEndpoint: defaultRpcNode,
          selectedNode: selectedNode as BlockchainNode,
          customNode,
          nodes: nodesWithStatuses,
          isBlockchainDown: nodeStatus.status === "inactive"
        });
      }

      // If the user has no settings or the selected node is inactive, use the fastest available active node
      if (!selectedNodeInSettings || (selectedNodeInSettings && settings.selectedNode?.status === "inactive")) {
        const randomNode = getFastestNode(nodesWithStatuses);
        // Use rpc proxy as a backup if there's no active nodes in the list
        defaultApiNode = randomNode?.api || netConfig.getBaseAPIUrl(netConfig.mapped(selectedNetwork.id));
        defaultRpcNode = randomNode?.rpc || netConfig.getBaseRpcUrl(netConfig.mapped(selectedNetwork.id));
        selectedNode = randomNode || {
          api: defaultApiNode,
          rpc: defaultRpcNode,
          status: "active",
          latency: 0,
          nodeInfo: null,
          id: netConfig.mapped(selectedNetwork.id)
        };
        if ((selectedNode as BlockchainNode).nodeInfo === null) {
          Object.assign(selectedNode, await loadNodeStatus(selectedNode.api));
        }
        updateSettings({
          ...settings,
          apiEndpoint: defaultApiNode,
          rpcEndpoint: defaultRpcNode,
          selectedNode: selectedNode as BlockchainNode,
          nodes: nodesWithStatuses,
          isBlockchainDown: (selectedNode as BlockchainNode).status === "inactive"
        });
      } else {
        defaultApiNode = settings.apiEndpoint;
        defaultRpcNode = settings.rpcEndpoint;
        selectedNode = settings.selectedNode;
        updateSettings({
          ...settings,
          apiEndpoint: defaultApiNode,
          rpcEndpoint: defaultRpcNode,
          selectedNode: selectedNode as BlockchainNode,
          nodes: nodesWithStatuses,
          isBlockchainDown: false
        });
      }

      setIsLoadingSettings(false);
      setIsSettingsInit(true);
    };

    initiateSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingNetworks]);

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
      const response = await externalApiHttpClient.get<{ result: NodeStatus }>(`${rpcUrl}/status`, {
        timeout: 5000,
        adapter: fetchAdapter,
        "axios-retry": {
          retries: 0
        }
      });
      nodeStatus = response.data.result;
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
   */
  const getFastestNode = (nodes: BlockchainNode[]) => {
    const healthyNodes = nodes.filter(n => n.status === "active" && n.nodeInfo?.sync_info.catching_up === false);
    if (healthyNodes.length === 0) return;
    return healthyNodes.reduce((fastestNode, node) => (node.latency < fastestNode.latency ? node : fastestNode));
  };

  const updateSettings: typeof setSettings = value => {
    setSettings(prevSettings => {
      const newSettings = typeof value === "function" ? value(prevSettings) : value;
      clearQueries(prevSettings, newSettings);
      setLocalStorageItem("settings", JSON.stringify(newSettings));

      return newSettings;
    });
  };

  const clearQueries = (prevSettings: Settings, newSettings: Settings) => {
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
      updateSettings(prevSettings => {
        const selectedNode = prevSettings.selectedNode ? _nodes.find(node => node.id === prevSettings.selectedNode?.id) : undefined;
        let isBlockchainDown: boolean;
        if (_isCustomNode) {
          isBlockchainDown = _customNode?.status === "inactive";
        } else {
          isBlockchainDown = selectedNode ? selectedNode.status === "inactive" : _nodes.every(node => node.status === "inactive");
        }

        return {
          ...prevSettings,
          nodes: _nodes,
          selectedNode,
          customNode: _customNode,
          isCustomNode: _isCustomNode,
          isBlockchainDown
        };
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

export const useSettings = (): SettingsContextType => {
  return { ...React.useContext(SettingsProviderContext) };
};
