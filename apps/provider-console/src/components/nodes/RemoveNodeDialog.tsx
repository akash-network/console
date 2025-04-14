import React from "react";
import { Alert, AlertDescription, AlertTitle, Popup, Spinner } from "@akashnetwork/ui/components";
import { WarningTriangle } from "iconoir-react";

import type { KubeNode } from "@src/types/kubeNode";
import { hasEtcdRole } from "@src/utils/nodeDistribution";

interface RemoveNodeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  node: KubeNode | null;
  controlPlaneCount: number;
  isLoading?: boolean;
  etcdCount?: number;
}

export const RemoveNodeDialog: React.FC<RemoveNodeDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  node,
  controlPlaneCount,
  etcdCount = 0,
  isLoading = false
}) => {
  if (!node) return null;

  // Safety check - don't allow removing node1
  if (node.name === "node1") {
    onClose();
    return null;
  }

  const isControlPlane = node.roles.toLowerCase().includes("control-plane");
  const isEtcd = hasEtcdRole(node.roles);

  // Calculate remaining nodes after removal
  const remainingControlNodes = isControlPlane ? controlPlaneCount - 1 : controlPlaneCount;
  const remainingEtcdNodes = isEtcd ? etcdCount - 1 : etcdCount;

  // Check for even number of nodes which could cause consensus issues
  const hasEvenControlNodes = remainingControlNodes > 0 && remainingControlNodes % 2 === 0;
  const hasEvenEtcdNodes = remainingEtcdNodes > 0 && remainingEtcdNodes % 2 === 0;

  // Determine the warning message based on the node type and count
  const getWarningMessage = () => {
    if (isEtcd && hasEvenEtcdNodes) {
      return (
        <Alert variant="warning" className="mt-4">
          <WarningTriangle className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            Removing this etcd node will leave your cluster with an even number of etcd nodes ({remainingEtcdNodes}). This could potentially cause a
            &quot;split-brain&quot; issue where the cluster cannot reach consensus. If this happens, the cluster may become unrecoverable and you may need to
            create a new one.
          </AlertDescription>
        </Alert>
      );
    } else if (isControlPlane && hasEvenControlNodes && !isEtcd) {
      return (
        <Alert variant="warning" className="mt-4">
          <WarningTriangle className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            Removing this control plane node will leave your cluster with an even number of control plane nodes ({remainingControlNodes}). This could
            potentially affect high availability, although consensus is managed by etcd nodes.
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };

  return (
    <Popup
      open={isOpen}
      onClose={onClose}
      title="Remove Node"
      variant="custom"
      enableCloseOnBackdropClick
      maxWidth="sm"
      actions={[
        {
          label: "Cancel",
          variant: "outline",
          side: "left",
          onClick: onClose,
          disabled: isLoading
        },
        {
          label: isLoading ? (
            <>
              <Spinner className="mr-2" size="small" />
              Removing Node...
            </>
          ) : (
            "Remove Node"
          ),
          variant: "destructive",
          side: "right",
          onClick: onConfirm,
          disabled: isLoading
        }
      ]}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p>
            Are you sure you want to remove the node <span className="font-medium">{node.name}</span>?
          </p>
          <p>The node will be cordoned to prevent new workloads from being scheduled on it before removal.</p>
          <p className="text-amber-600 dark:text-amber-400">
            Existing workloads might be affected, removed, or moved to other nodes if possible, which could cause restarts and temporary disruption to customer
            deployments.
          </p>
        </div>

        {getWarningMessage()}
      </div>
    </Popup>
  );
};
