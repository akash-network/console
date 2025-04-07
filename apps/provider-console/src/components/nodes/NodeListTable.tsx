import React from "react";
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

import { KubeNode } from "@src/types/kubeNode";

interface NodeListTableProps {
  nodes: KubeNode[];
}

export const NodeListTable: React.FC<NodeListTableProps> = ({ nodes }) => {
  // TODO: Implement Remove Node functionality
  const handleRemoveNodeClick = (nodeName: string) => {
    console.log("Remove Node clicked:", nodeName);
    // This will eventually trigger a confirmation modal and API call
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

  return (
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
                <Button variant="ghost" size="icon" onClick={() => handleRemoveNodeClick(node.name)} aria-label={`Remove node ${node.name}`}>
                  <Trash className="text-destructive h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
};
