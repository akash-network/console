import type { FC, ReactNode } from "react";
import { cn } from "@akashnetwork/ui/utils";

export interface DeploymentTabHeaderProps {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
  destructive?: boolean;
}

export const DeploymentTabHeader: FC<DeploymentTabHeaderProps> = ({ title, actions, children, destructive }) => (
  <div className="flex min-h-[50px] items-center justify-between gap-2">
    <div className="flex items-center gap-2">
      <h2 className={cn("text-sm font-normal text-muted-foreground", destructive && "text-destructive")}>{title}</h2>
      {children}
    </div>
    {actions}
  </div>
);
