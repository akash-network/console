import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  Input,
  Label,
  Separator
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { PcWarning } from "iconoir-react";

import { Title } from "@src/components/shared/Title";
import type { KubeNode } from "@src/types/kubeNode";
import { NodeServerForm } from "./NodeServerForm";

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingNodes: KubeNode[];
}

interface NodeDistribution {
  controlPlane: number;
  workerNodes: number;
}

type Step = "count" | "form";

export const AddNodeModal: React.FC<AddNodeModalProps> = ({ isOpen, onClose, existingNodes }) => {
  const [step, setStep] = useState<Step>("count");
  const [nodeCount, setNodeCount] = useState(1);
  const [showWarning, setShowWarning] = useState(false);
  const [proceedAnyway, setProceedAnyway] = useState(false);

  // Calculate current distribution
  const getCurrentDistribution = useCallback((): NodeDistribution => {
    return existingNodes.reduce(
      (acc, node) => {
        if (node.roles.includes("control-plane")) {
          return { ...acc, controlPlane: acc.controlPlane + 1 };
        }
        return { ...acc, workerNodes: acc.workerNodes + 1 };
      },
      { controlPlane: 0, workerNodes: 0 }
    );
  }, [existingNodes]);

  // Check if the node count might cause issues
  const checkForWarnings = useCallback(
    (count: number): string | null => {
      const current = getCurrentDistribution();

      if (existingNodes.length === 1 && count === 1) {
        return "Adding a single node to a single-node cluster may cause instability. We recommend adding at least 2 nodes for better reliability.";
      }

      if (current.controlPlane === 1 && count === 1) {
        return "Adding a single node to a cluster with one control plane node may lead to reduced availability. Consider adding multiple nodes for better reliability.";
      }

      return null;
    },
    [getCurrentDistribution, existingNodes]
  );

  // Effect to check for warnings when node count changes
  useEffect(() => {
    if (isOpen && nodeCount > 0) {
      const warning = checkForWarnings(nodeCount);
      setShowWarning(!!warning);
      setProceedAnyway(false);
    }
  }, [isOpen, nodeCount, checkForWarnings]);

  const handleNodeCountChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, parseInt(event.target.value, 10) || 1);
    setNodeCount(value);
  }, []);

  const handleProceed = useCallback(() => {
    if (showWarning && !proceedAnyway) {
      setProceedAnyway(true);
      return;
    }
    setStep("form");
  }, [showWarning, proceedAnyway]);

  const handleFormComplete = useCallback(() => {
    onClose();
  }, [onClose]);

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setStep("count");
    setNodeCount(1);
    setShowWarning(false);
    setProceedAnyway(false);
    onClose();
  }, [onClose]);

  const current = getCurrentDistribution();
  const warning = checkForWarnings(nodeCount);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn("max-w-[500px] p-8 transition-all duration-200", step === "form" && "max-w-[1000px]")}>
        <DialogHeader>
          <Title>Add New Nodes</Title>
          <DialogDescription>
            {step === "count" ? (
              <>
                Add new nodes to your Kubernetes cluster. Current distribution: {current.controlPlane} control plane, {current.workerNodes} worker nodes.
              </>
            ) : (
              <>
                Configure each node&apos;s access details. All nodes will be added to your cluster once you&apos;ve configured access for all {nodeCount} nodes.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {step === "count" ? (
          <>
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-4">
                <Label htmlFor="nodeCount" className="min-w-32">
                  Number of Nodes
                </Label>
                <Input id="nodeCount" type="number" min={1} value={nodeCount} onChange={handleNodeCountChange} className="w-24" />
              </div>

              {warning && (
                <Alert variant="destructive">
                  <PcWarning className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>{warning}</AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleProceed}>{showWarning && !proceedAnyway ? "I understand, continue" : "Continue"}</Button>
            </div>
          </>
        ) : (
          <NodeServerForm
            _currentServerNumber={existingNodes.length}
            onComplete={handleFormComplete}
            nodeCount={nodeCount}
            existingControlPlaneCount={current.controlPlane}
            existingWorkerCount={current.workerNodes}
            existingNodes={existingNodes}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
