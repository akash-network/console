"use client";
import type { FC, ReactNode } from "react";
import { useId, useMemo } from "react";

import { summarizeTemplateDeployment } from "./templateDeploymentSummary";

export interface TemplateDeploysAsProps {
  sdl: string | undefined;
}

export const TemplateDeploysAs: FC<TemplateDeploysAsProps> = ({ sdl }) => {
  const headingId = useId();
  const summary = useMemo(() => summarizeTemplateDeployment(sdl), [sdl]);

  if (!summary) return null;

  return (
    <section aria-labelledby={headingId} className="rounded-[14px] border border-border bg-card px-4 pb-1.5 pt-3.5 shadow-sm">
      <h2 id={headingId} className="pb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Deploys as
      </h2>
      <dl>
        {summary.gpu && <SpecRow label="GPU">{summary.gpu}</SpecRow>}
        <SpecRow label="vCPU">{summary.cpu}</SpecRow>
        <SpecRow label="Memory">{summary.memory}</SpecRow>
        <SpecRow label="Storage">{summary.storage}</SpecRow>
        {summary.persistentStorage && <SpecRow label="Persistent">{summary.persistentStorage}</SpecRow>}
        {summary.image ? (
          <SpecRow label="Image" title={summary.image}>
            {summary.image}
          </SpecRow>
        ) : (
          <SpecRow label="Services">{summary.serviceCount}</SpecRow>
        )}
      </dl>
    </section>
  );
};

const SpecRow: FC<{ label: string; title?: string; children: ReactNode }> = ({ label, title, children }) => (
  <div className="flex items-baseline justify-between gap-3 border-t border-border py-[9px]">
    <dt className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
    <dd className="min-w-0 truncate text-right font-mono text-xs text-foreground" title={title}>
      {children}
    </dd>
  </div>
);
