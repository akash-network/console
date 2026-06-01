import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Send } from "iconoir-react";

export const ConfigureDeploymentHeader: FC = () => {
  return (
    <header className="flex flex-row items-center justify-between gap-3 md:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-1 md:gap-2">
        <h1 className="text-xl font-bold leading-tight tracking-tight md:text-3xl md:leading-9">Configure your deployment</h1>
        <p className="hidden text-base text-muted-foreground md:block">
          Adjust your deployment spec to refine available providers in the compute marketplace. Request official quotes when you&apos;re ready.
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3 md:gap-6">
        <DeploymentSummaryBlock label="Deployment" value="—" />
        <div className="hidden h-12 w-px self-stretch bg-border md:block" aria-hidden="true" />
        <DeploymentSummaryBlock label="Cost" value="—" suffix="/hr" />
        <Button disabled className="h-9 shrink-0 px-3 md:h-10 md:px-8">
          <Send className="h-4 w-4 md:hidden" aria-label="Request quotes" />
          <span className="hidden md:inline">Request quotes</span>
        </Button>
      </div>
    </header>
  );
};

interface DeploymentSummaryBlockProps {
  label: string;
  value: string;
  suffix?: string;
}

function DeploymentSummaryBlock({ label, value, suffix }: DeploymentSummaryBlockProps) {
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[10px] uppercase text-muted-foreground md:text-sm">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-base font-semibold leading-tight md:text-xl md:leading-8">{value}</span>
        {suffix ? <span className="font-mono text-xs text-muted-foreground md:text-base">{suffix}</span> : null}
      </div>
    </div>
  );
}
