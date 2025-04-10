import React from "react";
import { cn } from "@akashnetwork/ui/utils";
import { Check, Circle, MinusCircle } from "lucide-react";

export type NodeStatus = "completed" | "in-progress" | "not-started";

export interface NodeConfig {
  isControlPlane: boolean;
  nodeNumber: number;
  status: NodeStatus;
}

interface ProgressSidebarProps {
  nodeConfigs: NodeConfig[];
  className?: string;
}

export const ProgressSidebar: React.FC<ProgressSidebarProps> = ({ nodeConfigs, className }) => {
  const getStatusIcon = (status: NodeStatus) => {
    switch (status) {
      case "completed":
        return <Check className="h-5 w-5 text-green-500" />;
      case "in-progress":
        return <Circle className="h-5 w-5 text-blue-500" />;
      case "not-started":
        return <MinusCircle className="h-5 w-5 text-gray-300" />;
    }
  };

  return (
    <div className={cn("w-56 shrink-0 space-y-2", className)}>
      <h4 className="mb-4 font-medium">Progress</h4>
      {nodeConfigs.map((config, index) => (
        <div key={index} className={cn("flex items-center gap-2 rounded-md p-2", config.status === "in-progress" && "bg-blue-50 dark:bg-blue-950")}>
          {getStatusIcon(config.status)}
          <span
            className={cn(
              "text-sm",
              config.status === "completed" && "text-green-500",
              config.status === "in-progress" && "text-blue-500",
              config.status === "not-started" && "text-gray-400"
            )}
          >
            {config.isControlPlane ? "Control Plane" : "Worker"} Node {config.nodeNumber}
          </span>
        </div>
      ))}
    </div>
  );
};
