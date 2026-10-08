import type { FC, ReactNode } from "react";

import type { DeployCtaState } from "../../deployCtaState/deployCtaState";
import { DeploymentResourceSummary } from "../../DeploymentResourceSummary/DeploymentResourceSummary";
import { WorkspaceCtaButton } from "../WorkspaceCtaButton/WorkspaceCtaButton";

export const DEPENDENCIES = { DeploymentResourceSummary };

type Props = {
  backButton: ReactNode;
  ctaState: DeployCtaState;
  onDeploy: () => void;
  onRetry: () => void;
  onCloseAndEdit: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/** Below lg the resources and the action move to the workspace's bottom bar, so the header keeps only the title there. */
export const ConfigureWorkspaceHeader: FC<Props> = ({ backButton, ctaState, onDeploy, onRetry, onCloseAndEdit, dependencies: d = DEPENDENCIES }) => (
  <header className="flex flex-col items-start gap-2.5">
    {backButton}
    <div className="flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-xl leading-tight md:text-3xl md:leading-9">Configure your deployment</h1>
        <p className="text-sm text-muted-foreground">In some instances, not all providers will submit a bid for your deployment.</p>
      </div>
      <div className="hidden flex-wrap items-center gap-x-6 gap-y-3 lg:flex">
        <d.DeploymentResourceSummary className="gap-x-5 text-lg font-medium [&_svg]:h-5 [&_svg]:w-5" />
        {ctaState !== "request-quotes" && <WorkspaceCtaButton state={ctaState} onDeploy={onDeploy} onRetry={onRetry} onCloseAndEdit={onCloseAndEdit} />}
      </div>
    </div>
  </header>
);
