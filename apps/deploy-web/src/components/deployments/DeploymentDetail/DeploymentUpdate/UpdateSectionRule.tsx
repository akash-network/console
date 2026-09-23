import type { FC, ReactNode } from "react";

export interface UpdateSectionRuleProps {
  title: string;
  trailing?: ReactNode;
}

export const UpdateSectionRule: FC<UpdateSectionRuleProps> = ({ title, trailing }) => (
  <div className="flex items-center gap-3">
    <span className="shrink-0 font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
    <span aria-hidden="true" className="h-px flex-1 bg-border" />
    {trailing && <span className="shrink-0 text-xs text-muted-foreground">{trailing}</span>}
  </div>
);
