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
  <header className="flex flex-col items-start gap-2.5">
    {backButton}
    <div className="flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-xl leading-tight md:text-3xl md:leading-9">Configure your deployment</h1>
        <p className="text-sm text-muted-foreground">In some instances, not all providers will submit a bid for your deployment.</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <d.DeploymentResourceSummary className="gap-x-5 text-lg font-medium [&_svg]:h-5 [&_svg]:w-5" />
        {ctaState !== "request-quotes" && <WorkspaceCta state={ctaState} onDeploy={onDeploy} onRetry={onRetry} onCloseAndEdit={onCloseAndEdit} />}
      </div>
    </div>
  </header>
);

type WorkspaceCtaProps = {
  state: Exclude<DeployCtaState, "request-quotes">;
  onDeploy: () => void;
  onRetry: () => void;
  onCloseAndEdit: () => void;
};

/** Pinned to the bottom of the screen below lg, where the header scrolls away with the page; the provider picker leaves room for it. */
function WorkspaceCta(props: WorkspaceCtaProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 grid border-t border-zinc-300 bg-background px-4 py-3 dark:border-zinc-700 lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0">
      <WorkspaceCtaButton {...props} />
    </div>
  );
}

function WorkspaceCtaButton({ state, onDeploy, onRetry, onCloseAndEdit }: WorkspaceCtaProps) {
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
