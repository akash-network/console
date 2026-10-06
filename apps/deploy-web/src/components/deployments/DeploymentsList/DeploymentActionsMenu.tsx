"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@akashnetwork/ui/components";
import { Ellipsis, SquarePen, SquareX, Upload } from "lucide-react";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useCloseDeploymentConfirm } from "@src/hooks/useCloseDeploymentConfirm";
import { isUsableDeploymentDefinition, sdlToRedeploy, useDeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { useRedeploy } from "@src/hooks/useRedeploy/useRedeploy";
import type { DeploymentDto } from "@src/types/deployment";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

export const DEPENDENCIES = {
  useLocalNotes,
  useWallet,
  useDeploymentDefinition,
  useCloseDeploymentConfirm,
  useRedeploy
};

export interface DeploymentActionsMenuProps {
  deployment: Pick<DeploymentDto, "dseq" | "state">;
  onDeploymentClosed?: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentActionsMenu: FC<DeploymentActionsMenuProps> = ({ deployment, onDeploymentClosed, dependencies: d = DEPENDENCIES }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { analyticsService } = useServices();
  const { changeDeploymentName } = d.useLocalNotes();
  const { address, signAndBroadcastTx } = d.useWallet();
  const { confirmCloseDeployment, recordCloseReason } = d.useCloseDeploymentConfirm();
  const redeploy = d.useRedeploy();
  /** Only once the menu is open, so a page of cards does not each fire a deployment read on mount. */
  const definition = d.useDeploymentDefinition(isOpen ? deployment.dseq : null, { acceptReferences: true });
  const isResolvingDefinition = definition.source === "resolving";
  const canRedeploy = isResolvingDefinition || isUsableDeploymentDefinition(definition);

  const closeDeployment = async () => {
    setIsOpen(false);

    const closeReason = await confirmCloseDeployment({ dseqs: [deployment.dseq], name: definition.name });
    if (!closeReason) return;

    const response = await signAndBroadcastTx([TransactionMessageData.getCloseDeploymentMsg(address, deployment.dseq)]);
    if (!response) return;

    recordCloseReason([deployment.dseq], closeReason);
    onDeploymentClosed?.();
    analyticsService.track("close_deployment", { category: "deployments", label: "Close deployment from list", reason: closeReason.closeReason });
  };

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Actions for deployment ${deployment.dseq}`} size="icon" variant="ghost" className="rounded-full">
          <Ellipsis className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={event => event.stopPropagation()}>
        <DropdownMenuItem onSelect={() => changeDeploymentName(deployment.dseq)}>
          <SquarePen className="mr-2 h-4 w-4" />
          Edit name
        </DropdownMenuItem>
        {canRedeploy && (
          <DropdownMenuItem
            disabled={isResolvingDefinition}
            onSelect={() => redeploy({ sdl: sdlToRedeploy(definition), name: definition.name, sourceDseq: deployment.dseq })}
          >
            <Upload className="mr-2 h-4 w-4" />
            Redeploy
          </DropdownMenuItem>
        )}
        {deployment.state === "active" && (
          <DropdownMenuItem onSelect={closeDeployment}>
            <SquareX className="mr-2 h-4 w-4" />
            Close
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
