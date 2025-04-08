import React, { useState } from "react";
import { Button, Spinner } from "@akashnetwork/ui/components";
import { useToast } from "@akashnetwork/ui/hooks";
import { Plus } from "iconoir-react";

import { Layout } from "@src/components/layout/Layout";
import { AddNodeModal } from "@src/components/nodes/AddNodeModal";
import { NodeListTable } from "@src/components/nodes/NodeListTable";
import { ControlMachineError } from "@src/components/shared/ControlMachineError";
import { Title } from "@src/components/shared/Title";
// import { withAuth } from "@src/components/shared/withAuth"; // Assuming auth is needed
import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useKubeNodesQuery } from "@src/queries/useKubeNodesQuery";
import { useRemoveNodeMutation } from "@src/queries/useRemoveNodeMutation";
import type { ControlMachineWithAddress } from "@src/types/controlMachine";
import type { KubeNode } from "@src/types/kubeNode";

const NodesPage: React.FunctionComponent = () => {
  const { toast } = useToast();
  const { activeControlMachine, controlMachineLoading } = useControlMachine();
  const { data: kubeNodesResponse, isLoading, error, refetch } = useKubeNodesQuery();
  const removeNodeMutation = useRemoveNodeMutation();
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);

  const nodes = kubeNodesResponse?.nodes || [];

  const handleAddNodeClick = () => {
    setIsAddNodeModalOpen(true);
  };

  const handleRemoveNode = async (node: KubeNode, controlMachine: ControlMachineWithAddress) => {
    try {
      await removeNodeMutation.mutateAsync({
        node,
        controlMachine
      });

      toast({
        variant: "default",
        title: "Node removal initiated",
        description: `Node ${node.name} is being removed from the cluster.`
      });

      // If we have an action_id, the mutation will handle the redirect in onSuccess
      // This toast is still useful for users to see even if they'll be redirected
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to remove node",
        description: "There was a problem removing the node. Please try again."
      });
    }
  };

  return (
    <Layout>
      <Title className="mb-4">Node Management</Title>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-muted-foreground text-sm">View and manage your Kubernetes cluster nodes.</p>
        <Button onClick={handleAddNodeClick} disabled={!activeControlMachine || controlMachineLoading || isLoading}>
          <Plus className="mr-2 h-4 w-4" />
          Add Nodes
        </Button>
      </div>

      <ControlMachineError className="mb-4" onRetry={refetch} />

      {controlMachineLoading && (
        <div className="flex items-center justify-center p-8">
          <Spinner size="large" />
        </div>
      )}

      {!controlMachineLoading && activeControlMachine && isLoading && (
        <div className="flex items-center justify-center p-8">
          <Spinner size="large" />
          <span className="text-muted-foreground ml-2">Loading nodes...</span>
        </div>
      )}

      {!controlMachineLoading && activeControlMachine && error && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-4 text-center">
          <p>Error loading nodes: {error.message}</p>
          <Button onClick={() => refetch()} variant="destructive" size="sm" className="mt-2">
            Retry
          </Button>
        </div>
      )}

      {!controlMachineLoading && activeControlMachine && !isLoading && !error && (
        <NodeListTable
          nodes={nodes}
          onRemoveNode={handleRemoveNode}
          activeControlMachine={activeControlMachine}
          isNodeRemovalLoading={removeNodeMutation.isPending}
        />
      )}

      <AddNodeModal isOpen={isAddNodeModalOpen} onClose={() => setIsAddNodeModalOpen(false)} existingNodes={nodes} />
    </Layout>
  );
};

// Wrap with withAuth if authentication is required for this page
// export default withAuth(NodesPage); // Temporarily remove withAuth wrapper
export default NodesPage; // Export directly for now
