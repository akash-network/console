import React from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Spinner } from "@akashnetwork/ui/components";
import { WarningTriangle } from "iconoir-react";

import type { KubeNode } from "@src/types/kubeNode";

interface RemoveNodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  node: KubeNode | null;
  controlPlaneCount: number;
  isLoading?: boolean;
}

export const RemoveNodeDialog: React.FC<RemoveNodeDialogProps> = ({ isOpen, onClose, onConfirm, node, controlPlaneCount, isLoading = false }) => {
  if (!node) return null;

  // Safety check - don't allow removing node1
  if (node.name === "node1") {
    onClose();
    return null;
  }

  const isControlPlane = node.roles.toLowerCase().includes("control-plane");
  const remainingControlNodes = isControlPlane ? controlPlaneCount - 1 : controlPlaneCount;
  const hasEvenControlNodes = remainingControlNodes > 0 && remainingControlNodes % 2 === 0;

  // Determine the warning message based on the node type and count
  const getWarningMessage = () => {
    if (isControlPlane && hasEvenControlNodes) {
      return (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3">
          <WarningTriangle className="h-5 w-5 flex-shrink-0 text-yellow-500" />
          <div className="text-sm text-yellow-700">
            <strong>Warning:</strong> Removing this control plane node will leave your cluster with an even number of control plane nodes (
            {remainingControlNodes}). This could potentially cause a "split-brain" issue where the cluster cannot reach consensus. If this happens, the cluster
            may become unrecoverable and you may need to create a new one.
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove Node</DialogTitle>
          <DialogDescription className="space-y-2 pt-1">
            <p>
              Are you sure you want to remove the node <span className="font-medium">{node.name}</span>?
            </p>
            <p>The node will be cordoned to prevent new workloads from being scheduled on it before removal.</p>
            <p className="text-amber-600 dark:text-amber-400">
              Existing workloads might be affected, removed, or moved to other nodes if possible, which could cause restarts and temporary disruption to
              customer deployments.
            </p>
          </DialogDescription>
        </DialogHeader>

        {getWarningMessage()}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner className="mr-2" size="small" />
                Removing Node...
              </>
            ) : (
              "Remove Node"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
