import React, { useCallback, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator
} from "@akashnetwork/ui/components";
import { useToast } from "@akashnetwork/ui/hooks";
import { cn } from "@akashnetwork/ui/utils";
import { Circle, MinusCircle, WarningCircle } from "iconoir-react";
import { Check } from "lucide-react";

import { useAddNodeMutation } from "@src/queries/useAddNodeMutation";
import { KubeNode } from "@src/types/kubeNode";
import { MachineAccess } from "../machine/MachineAccessForm";
import { NodeForm } from "./NodeForm";

interface SystemInfo {
  cpus: string;
  memory: string;
  public_ip: string;
  private_ip: string;
  os: string;
  storage: Array<{
    name: string;
    size: number;
    type: string;
    fstype: string | null;
    mountpoint: string | null;
    children?: Array<{
      name: string;
      size: number;
      type: string;
      fstype: string;
      mountpoint: string;
    }>;
  }>;
  gpu: {
    count: number;
    vendor: string | null;
    name: string | null;
    memory_size: string | null;
    interface: string | null;
  };
  has_sudo: boolean;
}

interface NodeInfo {
  access: MachineAccess;
  system_info: SystemInfo;
}

interface NodeServerFormProps {
  _currentServerNumber: number;
  onComplete: () => void;
  nodeCount: number;
  existingControlPlaneCount: number;
  existingWorkerCount: number;
  existingNodes: KubeNode[];
}

interface NodeConfig {
  isControlPlane: boolean;
  nodeNumber: number;
  status: "completed" | "in-progress" | "not-started";
}

const calculateNodeDistribution = (totalNewNodes: number, existingControlPlane: number, existingWorkers: number) => {
  const totalNodes = totalNewNodes + existingControlPlane + existingWorkers;
  let targetControlPlane = 0;

  // Calculate target number of control plane nodes for the entire cluster
  if (totalNodes <= 3) {
    targetControlPlane = 1;
  } else if (totalNodes <= 5) {
    targetControlPlane = 3;
  } else {
    const baseControlPlane = 3;
    const additionalPairs = Math.floor((totalNodes - 1) / 50);
    targetControlPlane = Math.min(baseControlPlane + additionalPairs * 2, 11); // Cap at 11 control plane nodes
  }

  // Calculate how many new control plane nodes we need
  const newControlPlaneNeeded = Math.max(0, targetControlPlane - existingControlPlane);
  const newControlPlane = Math.min(newControlPlaneNeeded, totalNewNodes);
  const newWorkers = totalNewNodes - newControlPlane;

  return {
    newControlPlane,
    newWorkers
  };
};

export const NodeServerForm: React.FC<NodeServerFormProps> = ({
  _currentServerNumber,
  onComplete,
  nodeCount,
  existingControlPlaneCount,
  existingWorkerCount,
  existingNodes
}) => {
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [useSharedConfig, setUseSharedConfig] = useState(false);
  const [firstNodeConfig, setFirstNodeConfig] = useState<NodeInfo | null>(null);
  const { toast } = useToast();
  const addNodeMutation = useAddNodeMutation();

  const distribution = calculateNodeDistribution(nodeCount, existingControlPlaneCount, existingWorkerCount);

  const [nodeConfigs, setNodeConfigs] = useState<NodeConfig[]>(() => {
    return Array(nodeCount)
      .fill(null)
      .map((_, index) => ({
        isControlPlane: index < distribution.newControlPlane,
        nodeNumber: index + 1,
        status: index === 0 ? "in-progress" : "not-started"
      }));
  });

  const handleNodeComplete = useCallback(
    async (nodeInfo: NodeInfo) => {
      // Update the current node's configuration
      setNodeConfigs(prev => prev.map((config, index) => (index === currentNodeIndex ? { ...config, status: "completed" } : config)));

      // Store the first node's config if it's the first node and shared config is enabled
      if (currentNodeIndex === 0) {
        setFirstNodeConfig(nodeInfo);
      }

      // If this is the last node, submit all nodes
      if (currentNodeIndex === nodeCount - 1) {
        const completedNodes = nodeConfigs.map((config, index) => {
          const nodeData = useSharedConfig && index > 0 && firstNodeConfig ? firstNodeConfig : nodeInfo;
          return {
            access: {
              hostname: nodeData.access.hostname,
              port: nodeData.access.port || 22,
              username: nodeData.access.username,
              password: nodeData.access.password || undefined,
              keyfile: nodeData.access.keyfile || undefined,
              passphrase: nodeData.access.passphrase || undefined
            },
            is_control_plane: config.isControlPlane,
            system_info: nodeData.system_info
          };
        });

        console.log("Sending add nodes request:", {
          nodes: completedNodes,
          existingNodes
        });

        try {
          await addNodeMutation.mutateAsync({
            nodes: completedNodes.map(node => ({
              access: {
                hostname: node.access.hostname,
                port: node.access.port,
                username: node.access.username,
                password: node.access.password,
                keyfile: node.access.keyfile,
                passphrase: node.access.passphrase
              },
              is_control_plane: node.is_control_plane,
              system_info: node.system_info
            })),
            existingNodes
          });
          onComplete();
        } catch (error: any) {
          console.error("Failed to add nodes:", error);
          toast({
            variant: "destructive",
            title: "Failed to Add Nodes",
            description: error.message || "An error occurred while adding the nodes. Please try again."
          });

          // Reset the current node's status
          setNodeConfigs(prev => prev.map((config, index) => (index === currentNodeIndex ? { ...config, status: "in-progress" } : config)));
        }
      } else {
        // Move to the next node
        setCurrentNodeIndex(prev => prev + 1);
      }
    },
    [currentNodeIndex, nodeCount, useSharedConfig, firstNodeConfig, addNodeMutation, onComplete, nodeConfigs, toast, existingNodes]
  );

  const handleSharedConfigChange = useCallback((checked: boolean) => {
    setUseSharedConfig(checked);
  }, []);

  // Calculate total control plane nodes if we change the current node type
  const getControlPlaneTotalIfChanged = (toControlPlane: boolean) => {
    const currentConfigControlPlane = nodeConfigs.reduce((sum, node, idx) => (idx === currentNodeIndex ? sum : node.isControlPlane ? sum + 1 : sum), 0);
    return currentConfigControlPlane + (toControlPlane ? 1 : 0) + existingControlPlaneCount;
  };

  // Count how many more control plane nodes we can potentially have
  const getPotentialControlPlaneCount = () => {
    // Count remaining unconfigured nodes (not including current node)
    const remainingNodes = nodeConfigs.filter((_, idx) => idx > currentNodeIndex).length;

    // Current control plane nodes (excluding current node)
    const currentControlPlane = nodeConfigs.reduce((sum, node, idx) => (idx === currentNodeIndex ? sum : node.isControlPlane ? sum + 1 : sum), 0);

    return currentControlPlane + remainingNodes + existingControlPlaneCount;
  };

  // Find the next best node to convert to control plane
  const findNodeToConvertToControlPlane = () => {
    // First try to find an unconfigured node (not completed)
    const unconfiguredIndex = nodeConfigs.findIndex((node, idx) => !node.isControlPlane && idx !== currentNodeIndex && node.status !== "completed");

    if (unconfiguredIndex !== -1) return unconfiguredIndex;

    // If no unconfigured nodes, find any worker node that's not the current one
    return nodeConfigs.findIndex((node, idx) => !node.isControlPlane && idx !== currentNodeIndex);
  };

  const handleNodeTypeChange = useCallback(
    (value: string) => {
      const wouldBeControlPlane = value === "control-plane";
      const isCurrentlyControlPlane = nodeConfigs[currentNodeIndex].isControlPlane;
      const totalControlPlane = getControlPlaneTotalIfChanged(wouldBeControlPlane);

      // If changing to control plane and would result in even number, don't allow
      if (wouldBeControlPlane && totalControlPlane % 2 === 0) {
        return;
      }

      // If changing from control plane to worker and would result in even number
      if (!wouldBeControlPlane && isCurrentlyControlPlane && totalControlPlane % 2 === 0) {
        // Find another node to convert to control plane
        const nodeToConvert = findNodeToConvertToControlPlane();

        if (nodeToConvert !== -1) {
          // Update both the current node and the found node
          setNodeConfigs(prev =>
            prev.map((config, index) => ({
              ...config,
              isControlPlane: index === currentNodeIndex ? false : index === nodeToConvert ? true : config.isControlPlane
            }))
          );
          return;
        }
        // If no node found to convert, don't allow the change
        return;
      }

      // Normal case - just update the current node
      setNodeConfigs(prev =>
        prev.map((config, index) => ({
          ...config,
          isControlPlane: index === currentNodeIndex ? wouldBeControlPlane : config.isControlPlane
        }))
      );
    },
    [currentNodeIndex, existingControlPlaneCount, nodeConfigs]
  );

  const getStatusIcon = (status: NodeConfig["status"]) => {
    switch (status) {
      case "completed":
        return <Check className="h-5 w-5 text-green-500" />;
      case "in-progress":
        return <Circle className="h-5 w-5 text-blue-500" />;
      case "not-started":
        return <MinusCircle className="h-5 w-5 text-gray-300" />;
    }
  };

  // Check if changing to control plane would create an even number
  const wouldBeEvenControlPlane = getControlPlaneTotalIfChanged(true) % 2 === 0;

  // Calculate if we can change current node to worker (if it's a control plane node)
  const canChangeToWorker = !nodeConfigs[currentNodeIndex].isControlPlane || findNodeToConvertToControlPlane() !== -1;

  // Check if current node's type matches our initial recommendation
  const isDefaultConfiguration = nodeConfigs[currentNodeIndex].isControlPlane === currentNodeIndex < distribution.newControlPlane;

  // Check if we have enough remaining nodes to potentially reach the target control plane count
  const hasEnoughRemainingNodes = getPotentialControlPlaneCount() >= distribution.newControlPlane;

  return (
    <div className="flex gap-8 p-6">
      {/* Progress Sidebar */}
      <div className="w-56 shrink-0 space-y-2">
        <h4 className="mb-4 font-medium">Progress</h4>
        {nodeConfigs.map((config, index) => (
          <div key={index} className={cn("flex items-center gap-2 rounded-md p-2", config.status === "in-progress" && "bg-blue-50 dark:bg-blue-950")}>
            {getStatusIcon(config.status)}
            <span
              className={cn(
                "text-sm",
                config.status === "completed" && "text-green-500",
                config.status === "in-progress" && "text-blue-500",
                config.status === "not-started" && "text-gray-400"
              )}
            >
              {config.isControlPlane ? "Control Plane" : "Worker"} Node {config.nodeNumber}
            </span>
          </div>
        ))}
      </div>

      {/* Form Content */}
      <div className="flex-1">
        {currentNodeIndex === 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <Checkbox id="useSharedConfig" checked={useSharedConfig} onCheckedChange={handleSharedConfigChange} />
              <Label htmlFor="useSharedConfig">Use same configuration for all nodes</Label>
            </div>
          </div>
        )}

        {!useSharedConfig || currentNodeIndex === 0 ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Select
                value={nodeConfigs[currentNodeIndex].isControlPlane ? "control-plane" : "worker"}
                onValueChange={handleNodeTypeChange}
                disabled={useSharedConfig && currentNodeIndex > 0}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select node type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="control-plane" disabled={wouldBeEvenControlPlane}>
                    Control Plane Node
                  </SelectItem>
                  <SelectItem value="worker" disabled={!canChangeToWorker}>
                    Worker Node
                  </SelectItem>
                </SelectContent>
              </Select>

              {!isDefaultConfiguration && hasEnoughRemainingNodes && (
                <Alert>
                  <WarningCircle className="h-4 w-4" />
                  <AlertTitle>Node Type Changed</AlertTitle>
                  <AlertDescription>You've changed the recommended node type. This may affect cluster stability.</AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {nodeConfigs[currentNodeIndex] && (
              <NodeForm
                key={currentNodeIndex}
                isControlPlane={nodeConfigs[currentNodeIndex].isControlPlane}
                nodeNumber={nodeConfigs[currentNodeIndex].nodeNumber}
                onComplete={handleNodeComplete}
                _defaultValues={useSharedConfig && currentNodeIndex > 0 && firstNodeConfig ? firstNodeConfig.access : undefined}
              />
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <Alert>
              <AlertTitle>Using Shared Configuration</AlertTitle>
              <AlertDescription>This node will use the same configuration as Node 1. Click Next to continue.</AlertDescription>
            </Alert>
            <div className="flex justify-end">
              <Button onClick={() => handleNodeComplete(firstNodeConfig!)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
