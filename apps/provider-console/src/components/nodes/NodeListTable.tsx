import { useState } from "react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { differenceInDays, formatDistanceToNowStrict } from "date-fns";
import { Trash } from "iconoir-react";

import type { ControlMachineWithAddress } from "@src/types/controlMachine";
import type { KubeNode } from "@src/types/kubeNode";
import { RemoveNodeDialog } from "./RemoveNodeDialog";

interface NodeListTableProps {
  nodes: KubeNode[];
  onRemoveNode: (node: KubeNode, controlMachine: ControlMachineWithAddress) => Promise<void>;
  activeControlMachine?: ControlMachineWithAddress;
  isNodeRemovalLoading?: boolean;
}

export const NodeListTable = ({ nodes, onRemoveNode, activeControlMachine, isNodeRemovalLoading = false }: NodeListTableProps) => {
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<KubeNode | null>(null);

  // Count the number of control-plane nodes
  const controlPlaneNodes = nodes.filter(node => node.roles.toLowerCase().includes("control-plane"));
  const controlPlaneCount = controlPlaneNodes.length;

  const handleRemoveNodeClick = (node: KubeNode) => {
    setSelectedNode(node);
    setRemoveDialogOpen(true);
  };

  const closeRemoveDialog = () => {
    setRemoveDialogOpen(false);
    setSelectedNode(null);
  };

  const confirmNodeRemoval = async () => {
    if (selectedNode && activeControlMachine) {
      await onRemoveNode(selectedNode, activeControlMachine);
      closeRemoveDialog();
    }
  };

  const getStatusClass = (status: string) => {
    // Assuming status is 'True' for Ready, adjust as needed
    return status === "True" ? "text-green-500" : "text-red-500";
  };

  const formatAge = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      // Show relative time for recent dates, absolute for older ones
      if (differenceInDays(now, date) < 7) {
        return formatDistanceToNowStrict(date, { addSuffix: true });
      } else {
        return date.toLocaleDateString();
      }
    } catch (e) {
      return "Invalid Date";
    }
  };

  // Check if a node can be removed
  const canRemoveNode = (node: KubeNode) => {
    // If it's the only control-plane node, it cannot be removed
    if (node.roles.toLowerCase().includes("control-plane") && controlPlaneCount <= 1) {
      return false;
    }

    // Don't allow removal of node1 or the control machine node
    if (node.name === "node1" || (activeControlMachine?.access?.hostname && node.externalIP === activeControlMachine.access.hostname)) {
      return false;
    }

    return true;
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Internal IP</TableHead>
            <TableHead>External IP</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Age</TableHead>
            <TableHead></TableHead> {/* Actions column */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {nodes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center">
                No nodes found.
              </TableCell>
            </TableRow>
          ) : (
            nodes.map(node => (
              <TableRow key={node.name}>
                <TableCell className="py-1 align-middle">
                  <TooltipProvider>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <span className="block truncate">{node.name}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>OS: {node.osImage}</p>
                        <p>Kernel: {node.kernelVersion}</p>
                        <p>Runtime: {node.containerRuntime}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className={cn(getStatusClass(node.status), "py-1 align-middle")}>{node.status === "True" ? "Ready" : "NotReady"}</TableCell>
                <TableCell className="truncate py-1 align-middle">{node.roles}</TableCell>
                <TableCell className="py-1 align-middle">{node.internalIP}</TableCell>
                <TableCell className="py-1 align-middle">{node.externalIP || "-"}</TableCell>
                <TableCell className="py-1 align-middle">{node.version}</TableCell>
                <TableCell className="py-1 align-middle">{formatAge(node.age)}</TableCell>
                <TableCell className="py-1 text-right align-middle">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveNodeClick(node)}
                            aria-label={`Remove node ${node.name}`}
                            disabled={!canRemoveNode(node) || !activeControlMachine || isNodeRemovalLoading}
                          >
                            <Trash className={cn("h-4 w-4", canRemoveNode(node) ? "text-destructive" : "text-muted-foreground")} />
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {!activeControlMachine && (
                        <TooltipContent>
                          <p>Control machine not configured</p>
                        </TooltipContent>
                      )}
                      {!canRemoveNode(node) && activeControlMachine && (
                        <TooltipContent>
                          {node.name === "node1" || node.externalIP === activeControlMachine.access.hostname ? (
                            <p>Cannot delete control machine node</p>
                          ) : node.roles.toLowerCase().includes("control-plane") && controlPlaneCount <= 1 ? (
                            <p>Cannot remove the only control-plane node</p>
                          ) : (
                            <p>This node cannot be removed</p>
                          )}
                        </TooltipContent>
                      )}
                      {isNodeRemovalLoading && (
                        <TooltipContent>
                          <p>Node removal in progress</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Remove Node Dialog */}
      <RemoveNodeDialog
        isOpen={removeDialogOpen}
        onClose={closeRemoveDialog}
        onConfirm={confirmNodeRemoval}
        node={selectedNode}
        controlPlaneCount={controlPlaneCount}
        isLoading={isNodeRemovalLoading}
      />
    </>
  );
};
