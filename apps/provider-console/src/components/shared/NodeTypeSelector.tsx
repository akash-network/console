import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";

import { isValidControlPlaneCount } from "@src/utils/nodeDistribution";

interface NodeTypeSelectorProps {
  /**
   * Current node type is control plane or worker
   */
  isControlPlane: boolean;
  /**
   * Callback for when node type changes
   */
  onNodeTypeChange: (isControlPlane: boolean) => void;
  /**
   * Total control plane nodes if current node type is changed
   * @param toControlPlane - Whether changing to control plane
   */
  getControlPlaneTotalIfChanged: (toControlPlane: boolean) => number;
  /**
   * Whether changing to worker is possible based on control plane requirements
   */
  canChangeToWorker?: boolean;
  /**
   * Whether the component is disabled
   */
  disabled?: boolean;
}

/**
 * A component for selecting between control plane and worker node types
 */
export const NodeTypeSelector: React.FC<NodeTypeSelectorProps> = ({
  isControlPlane,
  onNodeTypeChange,
  getControlPlaneTotalIfChanged,
  canChangeToWorker = true,
  disabled = false
}) => {
  // Check if changing to control plane would result in an invalid (even) count
  const wouldBeInvalidControlPlaneCount = !isValidControlPlaneCount(getControlPlaneTotalIfChanged(true));

  return (
    <div className="flex items-center gap-4">
      <Select value={isControlPlane ? "control-plane" : "worker"} onValueChange={value => onNodeTypeChange(value === "control-plane")} disabled={disabled}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select node type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="control-plane" disabled={wouldBeInvalidControlPlaneCount && !isControlPlane}>
            Control Plane Node
          </SelectItem>
          <SelectItem value="worker" disabled={!canChangeToWorker}>
            Worker Node
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
