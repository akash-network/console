import type { FC } from "react";
import { Button } from "@akashnetwork/ui/components";
import { LoaderCircleIcon, RocketIcon } from "lucide-react";

import { AccountSpendGate } from "@src/components/user/AccountActionGate/AccountActionGate";
import type { DeployCtaState } from "../../deployCtaState/deployCtaState";

export const DEPENDENCIES = { AccountSpendGate };

export type WorkspaceCtaState = Exclude<DeployCtaState, "request-quotes">;

type Props = {
  state: WorkspaceCtaState;
  onDeploy: () => void;
  onRetry: () => void;
  onCloseAndEdit: () => void;
  dependencies?: typeof DEPENDENCIES;
};

const CTA_CLASSES = "h-10 shrink-0 gap-2 px-6";

export const WorkspaceCtaButton: FC<Props> = ({ state, onDeploy, onRetry, onCloseAndEdit, dependencies: d = DEPENDENCIES }) => {
  switch (state) {
    case "requesting":
      return (
        <Button type="button" disabled className={CTA_CLASSES}>
          <LoaderCircleIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
          Requesting…
        </Button>
      );
    case "select-providers":
      return (
        <Button type="button" disabled className={CTA_CLASSES}>
          Select providers to deploy
        </Button>
      );
    case "deploy":
      return (
        <d.AccountSpendGate>
          <Button type="button" onClick={onDeploy} className={CTA_CLASSES}>
            <RocketIcon className="h-4 w-4" aria-hidden="true" />
            Deploy
          </Button>
        </d.AccountSpendGate>
      );
    case "deploying":
      return (
        <Button type="button" disabled className={CTA_CLASSES}>
          <LoaderCircleIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
          Deploying…
        </Button>
      );
    case "retry":
      return (
        <d.AccountSpendGate>
          <Button type="button" onClick={onRetry} className={CTA_CLASSES}>
            Retry
          </Button>
        </d.AccountSpendGate>
      );
    case "close-and-edit":
      return (
        <Button type="button" onClick={onCloseAndEdit} className={CTA_CLASSES}>
          Close and Edit
        </Button>
      );
  }
};
