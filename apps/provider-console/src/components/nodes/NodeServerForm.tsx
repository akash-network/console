import React, { useCallback, useState } from "react";
import { Alert, AlertDescription, AlertTitle, Separator, Spinner } from "@akashnetwork/ui/components";
import { useToast } from "@akashnetwork/ui/hooks";
import { PcWarning } from "iconoir-react";

import type { MachineAccess } from "@src/components/machine/MachineAccessForm";
import { NodeTypeSelector } from "@src/components/shared/NodeTypeSelector";
import { ProgressSidebar } from "@src/components/shared/ProgressSidebar";
import { useAddNodeMutation } from "@src/queries/useAddNodeMutation";
import type { KubeNode } from "@src/types/kubeNode";
import type { SystemInfo } from "@src/types/systemInfo";
import { NodeForm } from "./NodeForm";

interface NodeInfo {
  access: MachineAccess;
  system_info: SystemInfo;
}

interface NodeServerFormProps {
  nodeCount: number;
  existingControlPlaneCount: number;
  existingNodes: KubeNode[];
}

interface NodeConfig {
  isControlPlane: boolean;
  isEtcd?: boolean;
  nodeNumber: number;
  status: "not-started" | "in-progress" | "completed";
  warning?: string;
}

export const NodeServerForm: React.FC<NodeServerFormProps> = ({ nodeCount, existingControlPlaneCount, existingNodes }) => {
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [firstNodeConfig, setFirstNodeConfig] = useState<NodeInfo | null>(null);
  const [useSharedConfig, setUseSharedConfig] = useState(false);
  const [completedNodeInfos, setCompletedNodeInfos] = useState<(NodeInfo | null)[]>(Array(nodeCount).fill(null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const addNodeMutation = useAddNodeMutation();

  // Calculate existing counts
  const totalMachineCount = existingNodes.length + nodeCount;

  // Helper function to determine required control plane count based on total machines
  const getRequiredControlPlaneCount = (machineCount: number) => {
    if (machineCount <= 3) return 1;
    if (machineCount <= 50) return 3;
    if (machineCount <= 100) return 5;
    return 7;
  };

  // Initialize node configs based on machine count rules
  const [nodeConfigs, setNodeConfigs] = useState<NodeConfig[]>(() => {
    const requiredControlPlane = getRequiredControlPlaneCount(totalMachineCount);

    // If we already have enough or more control plane nodes, don't add more
    if (existingControlPlaneCount >= requiredControlPlane) {
      return Array(nodeCount)
        .fill(null)
        .map((_, index) => ({
          isControlPlane: false,
          isEtcd: false,
          nodeNumber: index + 1,
          status: index === 0 ? "in-progress" : "not-started"
        }));
    }

    // Calculate how many new control plane nodes we need
    const neededControlPlane = requiredControlPlane - existingControlPlaneCount;

    return Array(nodeCount)
      .fill(null)
      .map((_, index) => {
        // First add needed control-plane+etcd nodes, then regular worker nodes
        const isControlPlane = index < neededControlPlane;
        // All control plane nodes should also be etcd nodes
        const isEtcd = isControlPlane;

        return {
          isControlPlane,
          isEtcd,
          nodeNumber: index + 1,
          status: index === 0 ? "in-progress" : "not-started"
        };
      });
  });

  const handleNodeComplete = useCallback(
    async (nodeInfo: NodeInfo) => {
      setNodeConfigs(prev => prev.map((config, index) => (index === currentNodeIndex ? { ...config, status: "completed" } : config)));

      setCompletedNodeInfos(prev => {
        const updated = [...prev];
        updated[currentNodeIndex] = nodeInfo;
        return updated;
      });

      if (currentNodeIndex === 0) {
        setUseSharedConfig(Boolean(nodeInfo.access.saveInformation));
        setFirstNodeConfig(nodeInfo);
      }

      if (currentNodeIndex === nodeCount - 1) {
        const completedNodes = nodeConfigs.map((config, index) => {
          let nodeData;

          if (index === currentNodeIndex) {
            nodeData = nodeInfo;
          } else if (completedNodeInfos[index]) {
            nodeData = completedNodeInfos[index];
          }
          // Fallback to shared config when appropriate
          else if (useSharedConfig && firstNodeConfig) {
            nodeData = {
              ...firstNodeConfig,
              access: {
                ...firstNodeConfig.access,
                // This shouldn't happen in normal flow since we store all completed nodes
                hostname: "MISSING_HOSTNAME"
              }
            };
          }
          // Last resort fallback
          else {
            nodeData = nodeInfo;
          }

          // Check if the node has GPUs
          const hasGpus = nodeData.system_info?.gpu?.count > 0;

          return {
            hostname: nodeData.access.hostname,
            port: nodeData.access.port || 22,
            username: nodeData.access.username,
            password: nodeData.access.password || undefined,
            keyfile: nodeData.access.keyfile || undefined,
            passphrase: nodeData.access.passphrase || undefined,
            isControlPlane: config.isControlPlane,
            installGpuDrivers: hasGpus
          };
        });

        try {
          setIsSubmitting(true);
          await addNodeMutation.mutateAsync({
            nodes: completedNodes,
            existingNodes
          });
          // The mutation's onSuccess will handle navigation to activity-logs page
          // No need to call onComplete here
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Failed to Add Nodes",
            description: error.message || "An error occurred while adding the nodes. Please try again."
          });

          // Reset the current node's status
          setNodeConfigs(prev => prev.map((config, index) => (index === currentNodeIndex ? { ...config, status: "in-progress" } : config)));
        } finally {
          setIsSubmitting(false);
        }
      } else {
        // Move to the next node
        setCurrentNodeIndex(prev => prev + 1);
      }
    },
    [currentNodeIndex, nodeCount, useSharedConfig, firstNodeConfig, addNodeMutation, toast, nodeConfigs, existingNodes, completedNodeInfos]
  );

  // Get total control plane count
  const getControlPlaneTotalIfChanged = useCallback(
    (toControlPlane: boolean) => {
      const currentConfigControlPlane = nodeConfigs.reduce((sum, node, idx) => (idx === currentNodeIndex ? sum : node.isControlPlane ? sum + 1 : sum), 0);
      return currentConfigControlPlane + (toControlPlane ? 1 : 0) + existingControlPlaneCount;
    },
    [nodeConfigs, currentNodeIndex, existingControlPlaneCount]
  );

  // Enhanced node type change handling with validation and warnings
  const handleNodeTypeChange = useCallback(
    (isControlPlane: boolean, isEtcd: boolean = false) => {
      // Force consistency: etcd requires control plane and vice versa in our case
      if (isEtcd) isControlPlane = true;
      if (isControlPlane) isEtcd = true;

      // Calculate totals if we make this change
      const newControlPlaneTotal = getControlPlaneTotalIfChanged(isControlPlane);
      const requiredControlPlane = getRequiredControlPlaneCount(totalMachineCount);

      // Generate warnings based on the configuration
      let warning: string | undefined;

      // Validate against our scaling rules
      if (isControlPlane) {
        if (newControlPlaneTotal > requiredControlPlane) {
          warning = `For ${totalMachineCount} machines, you should have exactly ${requiredControlPlane} control plane nodes with etcd (you already have ${existingControlPlaneCount}).`;
        }
      }

      // Force first node to be control plane if none exist
      if (currentNodeIndex === 0 && existingControlPlaneCount === 0) {
        if (!isControlPlane) {
          isControlPlane = true;
          isEtcd = true;
          warning = "First node must be a control plane node with etcd when no control plane nodes exist.";
        }
      }

      // Warn if trying to add worker node when we don't have enough control plane nodes
      const totalControlPlaneAfterChanges =
        existingControlPlaneCount +
        nodeConfigs.reduce((sum, node, idx) => {
          if (idx === currentNodeIndex) return sum; // Exclude current node as it's being changed
          return sum + (node.isControlPlane ? 1 : 0);
        }, 0) +
        (isControlPlane ? 1 : 0);

      if (!isControlPlane && totalControlPlaneAfterChanges < requiredControlPlane) {
        warning = `You need ${requiredControlPlane} control plane nodes for ${totalMachineCount} machines (you have ${existingControlPlaneCount} existing + ${totalControlPlaneAfterChanges - existingControlPlaneCount} new = ${totalControlPlaneAfterChanges} total). Please add ${requiredControlPlane - totalControlPlaneAfterChanges} more control plane nodes.`;
      }

      // Update the node configuration
      setNodeConfigs(prev =>
        prev.map((config, index) => {
          if (index === currentNodeIndex) {
            return {
              ...config,
              isControlPlane,
              isEtcd,
              warning
            };
          }
          return config;
        })
      );
    },
    [currentNodeIndex, getControlPlaneTotalIfChanged, existingControlPlaneCount, nodeConfigs, totalMachineCount]
  );

  return (
    <div className="relative flex gap-8 p-6">
      {isSubmitting && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50">
          <div className="flex flex-col items-center gap-4 rounded-lg bg-white p-6 shadow-lg">
            <Spinner className="h-8 w-8" />
            <div>Adding nodes to cluster...</div>
          </div>
        </div>
      )}

      {/* Progress Sidebar */}
      <ProgressSidebar nodeConfigs={nodeConfigs} />

      {/* Form Content */}
      <div className="flex-1">
        <div className="space-y-6">
          {/* Enhanced NodeTypeSelector that allows changes with warnings */}
          <div className="space-y-4">
            <NodeTypeSelector
              isControlPlane={nodeConfigs[currentNodeIndex].isControlPlane}
              isEtcd={nodeConfigs[currentNodeIndex].isEtcd}
              onNodeTypeChange={handleNodeTypeChange}
              disabled={false}
              showAutoAssignMessage={false}
            />

            {nodeConfigs[currentNodeIndex].warning && (
              <Alert variant="warning">
                <PcWarning className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>{nodeConfigs[currentNodeIndex].warning}</AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {nodeConfigs[currentNodeIndex] && (
            <NodeForm
              key={`node-form-${currentNodeIndex}`}
              isControlPlane={nodeConfigs[currentNodeIndex].isControlPlane}
              isEtcd={nodeConfigs[currentNodeIndex].isEtcd}
              nodeNumber={nodeConfigs[currentNodeIndex].nodeNumber}
              onComplete={isSubmitting ? () => {} : handleNodeComplete}
              _defaultValues={
                useSharedConfig && currentNodeIndex > 0 && firstNodeConfig
                  ? {
                      ...firstNodeConfig.access,
                      hostname: "",
                      // Make sure keyfile is passed correctly
                      keyfile: firstNodeConfig.access.keyfile
                    }
                  : undefined
              }
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </div>
  );
};
