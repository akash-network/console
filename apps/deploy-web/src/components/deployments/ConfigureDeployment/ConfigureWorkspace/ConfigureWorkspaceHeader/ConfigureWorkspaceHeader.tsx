import type { FC, ReactNode } from "react";
import { Button } from "@akashnetwork/ui/components";
import { LoaderCircleIcon, RocketIcon } from "lucide-react";

import type { DeployCtaState } from "../../deployCtaState/deployCtaState";
import { DeploymentResourceSummary } from "../../DeploymentResourceSummary/DeploymentResourceSummary";

export const DEPENDENCIES = { DeploymentResourceSummary };

type Props = {
  backButton: ReactNode;
  ctaState: DeployCtaState;
  onDeploy: () => void;
  onRetry: () => void;
  onCloseAndEdit: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const ConfigureWorkspaceHeader: FC<Props> = ({ backButton, ctaState, onDeploy, onRetry, onCloseAndEdit, dependencies: d = DEPENDENCIES }) => (
  <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
      <div className="flex">{backButton}</div>
      <h1 className="text-xl leading-tight md:text-3xl md:leading-9">Configure your deployment</h1>
      <p className="col-start-2 text-sm text-muted-foreground">In some instances, not all providers will submit a bid for your deployment.</p>
    </div>
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <d.DeploymentResourceSummary className="gap-x-5 text-lg font-medium [&_svg]:h-5 [&_svg]:w-5" />
      {ctaState !== "request-quotes" && <WorkspaceCta state={ctaState} onDeploy={onDeploy} onRetry={onRetry} onCloseAndEdit={onCloseAndEdit} />}
    </div>
  </header>
);

type WorkspaceCtaProps = {
  state: Exclude<DeployCtaState, "request-quotes">;
  onDeploy: () => void;
  onRetry: () => void;
  onCloseAndEdit: () => void;
};

function WorkspaceCta({ state, onDeploy, onRetry, onCloseAndEdit }: WorkspaceCtaProps) {
  const className = "h-10 shrink-0 gap-2 px-6";
  switch (state) {
    case "requesting":
      return (
        <Button type="button" disabled className={className}>
          <LoaderCircleIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
          Requesting…
        </Button>
      );
    case "select-providers":
      return (
        <Button type="button" disabled className={className}>
          Select providers to deploy
        </Button>
      );
    case "deploy":
      return (
        <Button type="button" onClick={onDeploy} className={className}>
          <RocketIcon className="h-4 w-4" aria-hidden="true" />
          Deploy
        </Button>
      );
    case "retry":
      return (
        <Button type="button" onClick={onRetry} className={className}>
          Retry
        </Button>
      );
    case "close-and-edit":
      return (
        <Button type="button" onClick={onCloseAndEdit} className={className}>
          Close and Edit
        </Button>
      );
  }
}
