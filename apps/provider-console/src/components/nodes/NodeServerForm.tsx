import React, { useCallback, useState } from "react";
import { Separator, Spinner } from "@akashnetwork/ui/components";
import { useToast } from "@akashnetwork/ui/hooks";

import type { MachineAccess } from "@src/components/machine/MachineAccessForm";
import { NodeTypeSelector } from "@src/components/shared/NodeTypeSelector";
import { ProgressSidebar } from "@src/components/shared/ProgressSidebar";
import { useAddNodeMutation } from "@src/queries/useAddNodeMutation";
import type { KubeNode } from "@src/types/kubeNode";
import type { SystemInfo } from "@src/types/systemInfo";
import { hasEtcdRole } from "@src/utils/nodeDistribution";
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
}

export const NodeServerForm: React.FC<NodeServerFormProps> = ({ nodeCount, existingControlPlaneCount, existingNodes }) => {
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [firstNodeConfig, setFirstNodeConfig] = useState<NodeInfo | null>(null);
  const [useSharedConfig, setUseSharedConfig] = useState(false);
  const [completedNodeInfos, setCompletedNodeInfos] = useState<(NodeInfo | null)[]>(Array(nodeCount).fill(null));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const addNodeMutation = useAddNodeMutation();

  // Calculate existing etcd count
  const existingEtcdCount = existingNodes.filter(node => hasEtcdRole(node.roles)).length;

  // Initialize node configs based on etcd count
  const [nodeConfigs, setNodeConfigs] = useState<NodeConfig[]>(() => {
    return Array(nodeCount)
      .fill(null)
      .map((_, index) => {
        // Calculate the current etcd count including previous nodes in this batch
        const currentEtcdCount = existingEtcdCount + index;

        // If we have an even number of etcd nodes, make this a control-plane+etcd
        // Otherwise, make it a worker node
        const isEtcd = currentEtcdCount % 2 === 0;
        const isControlPlane = isEtcd; // Control plane is required for etcd

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
      // Update the current node's configuration
      setNodeConfigs(prev => prev.map((config, index) => (index === currentNodeIndex ? { ...config, status: "completed" } : config)));

      // Store the full node info for this index
      setCompletedNodeInfos(prev => {
        const updated = [...prev];
        updated[currentNodeIndex] = nodeInfo;
        console.log(`Saving nodeInfo for node ${currentNodeIndex + 1}:`, nodeInfo);
        return updated;
      });

      // Store the first node's config if it's the first node and shared config is enabled
      if (currentNodeIndex === 0) {
        // Check if user wants to use the same config for all nodes
        setUseSharedConfig(Boolean(nodeInfo.access.saveInformation));
        setFirstNodeConfig(nodeInfo);
        console.log("Saving first node config:", nodeInfo);
        console.log("Will use shared config:", Boolean(nodeInfo.access.saveInformation));
      }

      // If moving to the next node with shared config, log the values
      if (currentNodeIndex < nodeCount - 1 && useSharedConfig) {
        console.log("Moving to next node with shared config", {
          currentNodeIndex,
          firstNodeConfig,
          useSharedConfig
        });
      }

      // If this is the last node, submit all nodes
      if (currentNodeIndex === nodeCount - 1) {
        // Prepare nodes data for backend submission
        const completedNodes = nodeConfigs.map((config, index) => {
          let nodeData;

          // For the current (last) node, use the just-submitted data
          if (index === currentNodeIndex) {
            nodeData = nodeInfo;
            console.log(`Using current node info for node ${index + 1}`);
          }
          // For previously completed nodes, use their stored nodeInfo
          else if (completedNodeInfos[index]) {
            nodeData = completedNodeInfos[index];
            console.log(`Using stored node info for node ${index + 1}:`, nodeData?.access.hostname);
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
            console.log(`WARNING: Missing node info for node ${index + 1}, using shared config`);
          }
          // Last resort fallback
          else {
            nodeData = nodeInfo;
            console.log(`FALLBACK: Using current node info for node ${index + 1}`);
          }

          // Check if the node has GPUs
          const hasGpus = nodeData.system_info?.gpu?.count > 0;

          // Log the hostname we're using
          console.log(`Final hostname for node ${index + 1}: ${nodeData.access.hostname}`);

          // Return only the properties needed for the API request
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

        console.log("Final nodes data:", completedNodes);

        try {
          setIsSubmitting(true);
          await addNodeMutation.mutateAsync({
            nodes: completedNodes,
            existingNodes
          });
          // The mutation's onSuccess will handle navigation to activity-logs page
          // No need to call onComplete here
        } catch (error: any) {
          console.error("Failed to add nodes:", error);
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

  // Get total etcd count including nodes we're adding up to current index
  const getEtcdTotalIfChanged = useCallback(
    (toEtcd: boolean) => {
      // Calculate total etcd nodes if we change the current node
      const currentConfigEtcdCount = nodeConfigs.reduce((sum, node, idx) => (idx === currentNodeIndex ? sum : node.isEtcd ? sum + 1 : sum), 0);
      return currentConfigEtcdCount + (toEtcd ? 1 : 0) + existingEtcdCount;
    },
    [nodeConfigs, currentNodeIndex, existingEtcdCount]
  );

  // Get total control plane count
  const getControlPlaneTotalIfChanged = useCallback(
    (toControlPlane: boolean) => {
      const currentConfigControlPlane = nodeConfigs.reduce((sum, node, idx) => (idx === currentNodeIndex ? sum : node.isControlPlane ? sum + 1 : sum), 0);
      return currentConfigControlPlane + (toControlPlane ? 1 : 0) + existingControlPlaneCount;
    },
    [nodeConfigs, currentNodeIndex, existingControlPlaneCount]
  );

  // Simplified node type change handling that follows our rule:
  // If we have even etcd nodes, add control plane+etcd, otherwise add worker
  const handleNodeTypeChange = useCallback(
    (isControlPlane: boolean, isEtcd: boolean = false) => {
      // Force consistency: etcd requires control plane, and we don't allow manual changes
      if (isEtcd && !isControlPlane) {
        isControlPlane = true;
      }

      // Get the current etcd count
      const totalEtcdNodes = existingEtcdCount + nodeConfigs.filter((node, idx) => idx !== currentNodeIndex && node.isEtcd).length;

      // Decide node type based on etcd count
      const shouldBeEtcd = totalEtcdNodes % 2 === 0;
      const shouldBeControlPlane = shouldBeEtcd;

      // Set the node configuration based on our rule
      setNodeConfigs(prev =>
        prev.map((config, index) => {
          if (index === currentNodeIndex) {
            return {
              ...config,
              isControlPlane: shouldBeControlPlane,
              isEtcd: shouldBeEtcd
            };
          }
          return config;
        })
      );
    },
    [currentNodeIndex, nodeConfigs, existingEtcdCount]
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
          {/* Simplified NodeTypeSelector that shows the current node type but disables changes */}
          <NodeTypeSelector
            isControlPlane={nodeConfigs[currentNodeIndex].isControlPlane}
            isEtcd={nodeConfigs[currentNodeIndex].isEtcd}
            onNodeTypeChange={handleNodeTypeChange}
            getControlPlaneTotalIfChanged={getControlPlaneTotalIfChanged}
            getEtcdTotalIfChanged={getEtcdTotalIfChanged}
            // Disable manual type changes as we're now auto-assigning node types
            disabled={true}
            showAutoAssignMessage={true}
          />

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
