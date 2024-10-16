"use client";
import { cn } from "@akashnetwork/ui/utils";

import { StatusPill } from "./StatusPill";

type Props = {
  latency: number;
  status: string;
  variant?: "regular" | "dense";
};

export const NodeStatus: React.FunctionComponent<Props> = ({ latency, status, variant = "regular" }) => {
  return (
    <div className="flex items-center">
      <div>
        <span className={cn("text-muted-foreground", { ["text-sm"]: variant === "regular", ["text-xs"]: variant === "dense" })}>
          {latency}ms{latency >= 10000 && "+"}
        </span>
      </div>
      <div>
        <StatusPill state={status === "active" ? "active" : "closed"} size={variant === "regular" ? "medium" : "small"} />
      </div>
    </div>
  );
};
