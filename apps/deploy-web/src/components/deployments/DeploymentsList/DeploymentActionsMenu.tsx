"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@akashnetwork/ui/components";
import { Edit, MoreHoriz, Upload, XmarkSquare } from "iconoir-react";

import { useLocalNotes } from "@src/components/LocalNoteManager";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { isUsableDeploymentDefinition, useDeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { useManagedDeploymentConfirm } from "@src/hooks/useManagedDeploymentConfirm";
import { useRedeploy } from "@src/hooks/useRedeploy/useRedeploy";
import type { DeploymentDto } from "@src/types/deployment";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

export const DEPENDENCIES = {
  useLocalNotes,
  useWallet,
  useDeploymentDefinition,
  useManagedDeploymentConfirm,
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
  const { closeDeploymentConfirm } = d.useManagedDeploymentConfirm();
  const redeploy = d.useRedeploy();
  /** Only once the menu is open, so a page of cards does not each fire a deployment read on mount. */
  const definition = d.useDeploymentDefinition(isOpen ? deployment.dseq : null);
  const isResolvingDefinition = definition.source === "resolving";
  const canRedeploy = isResolvingDefinition || isUsableDeploymentDefinition(definition);

  const closeDeployment = async () => {
    setIsOpen(false);

    if (!(await closeDeploymentConfirm([deployment.dseq]))) return;

    const response = await signAndBroadcastTx([TransactionMessageData.getCloseDeploymentMsg(address, deployment.dseq)]);
    if (!response) return;

    onDeploymentClosed?.();
    analyticsService.track("close_deployment", { category: "deployments", label: "Close deployment from list" });
  };

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Actions for deployment ${deployment.dseq}`} size="icon" variant="ghost" className="rounded-full">
          <MoreHoriz />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={event => event.stopPropagation()}>
        <DropdownMenuItem onSelect={() => changeDeploymentName(deployment.dseq)}>
          <Edit className="mr-2 h-4 w-4" />
          Edit name
        </DropdownMenuItem>
        {canRedeploy && (
          <DropdownMenuItem disabled={isResolvingDefinition} onSelect={() => redeploy({ sdl: definition.sdl, name: definition.name })}>
            <Upload className="mr-2 h-4 w-4" />
            Redeploy
          </DropdownMenuItem>
        )}
        {deployment.state === "active" && (
          <DropdownMenuItem onSelect={closeDeployment}>
            <XmarkSquare className="mr-2 h-4 w-4" />
            Close
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
