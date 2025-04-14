import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";

interface NodeTypeSelectorProps {
  /**
   * Current node type is control plane or worker
   */
  isControlPlane: boolean;
  /**
   * Whether the node is running etcd
   */
  isEtcd?: boolean;
  /**
   * Callback for when node type changes
   */
  onNodeTypeChange: (isControlPlane: boolean, isEtcd?: boolean) => void;
  /**
   * Total control plane nodes if current node type is changed
   * @param toControlPlane - Whether changing to control plane
  /**
   * Whether the component is disabled
   */
  disabled?: boolean;
  /**
   * Whether to show that node type is automatically determined
   */
  showAutoAssignMessage?: boolean;
}

/**
 * A component for selecting between control plane and worker node types
 */
export const NodeTypeSelector: React.FC<NodeTypeSelectorProps> = ({
  isControlPlane,
  isEtcd = false,
  onNodeTypeChange,
  disabled = false,
  showAutoAssignMessage = false
}) => {
  // Get the current node type value
  const getCurrentNodeTypeValue = () => {
    if (isControlPlane) {
      return isEtcd ? "control-plane-etcd" : "control-plane";
    }
    return "worker";
  };

  // Handle node type changes
  const handleNodeTypeChange = (value: string) => {
    switch (value) {
      case "control-plane-etcd":
        onNodeTypeChange(true, true);
        break;
      case "control-plane":
        onNodeTypeChange(true, false);
        break;
      case "worker":
        onNodeTypeChange(false, false);
        break;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <Select value={getCurrentNodeTypeValue()} onValueChange={handleNodeTypeChange} disabled={disabled}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select node type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="control-plane-etcd">Control Plane / etcd</SelectItem>
            <SelectItem value="worker">Worker Node</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showAutoAssignMessage && (
        <div className="text-muted-foreground text-sm">
          Node type is automatically determined based on etcd count to maintain consensus.
          {isEtcd ? " This node will run etcd for cluster consensus." : " This node will be a worker node."}
        </div>
      )}
    </div>
  );
};
