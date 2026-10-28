import type { FC, ReactNode } from "react";

export interface DeploymentTabHeaderProps {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export const DeploymentTabHeader: FC<DeploymentTabHeaderProps> = ({ title, actions, children }) => (
  <div className="flex items-center justify-between gap-3 pb-3 pt-2">
    <div className="flex items-center gap-2">
      <h2 className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">{title}</h2>
      {children}
    </div>
    {actions}
  </div>
);
