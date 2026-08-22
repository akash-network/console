import type { FC, ReactNode } from "react";
import { cn } from "@akashnetwork/ui/utils";

export interface DeploymentTabHeaderProps {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
  destructive?: boolean;
}

export const DeploymentTabHeader: FC<DeploymentTabHeaderProps> = ({ title, actions, children, destructive }) => (
  <div className="flex items-center justify-between gap-2 pb-4">
    <div className="flex items-center gap-2">
      <h2 className={cn("text-sm font-normal text-muted-foreground", destructive && "text-destructive")}>{title}</h2>
      {children}
    </div>
    {actions}
  </div>
);
