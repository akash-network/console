"use client";
import type { ReactNode } from "react";
import { Popup, Spinner } from "@akashnetwork/ui/components";

export type LoadingState =
  | "waitingForApproval"
  | "broadcasting"
  | "searchingProviders"
  | "creatingDeployment"
  | "updatingDeployment"
  | "creatingLease"
  | "closingDeployment"
  | "depositingDeployment"
  | "mintingACT";

type Props = {
  state?: LoadingState;
  onClose?: () => void;
  children?: ReactNode;
};

const TITLES: Record<LoadingState, string> = {
  waitingForApproval: "Waiting for tx approval",
  broadcasting: "Transaction Pending",
  searchingProviders: "Searching Providers",
  creatingDeployment: "Creating Deployment",
  updatingDeployment: "Updating Deployment",
  creatingLease: "Creating Lease",
  closingDeployment: "Closing Deployment",
  depositingDeployment: "Depositing Deployment",
  mintingACT: "Minting ACT"
};

const DESCRIPTIONS: Partial<Record<LoadingState, string>> = {
  waitingForApproval: "APPROVE OR REJECT TX TO CONTINUE...",
  broadcasting: "BROADCASTING TRANSACTION...",
  mintingACT: "This should only take a moment"
};

export const TransactionModal: React.FunctionComponent<Props> = ({ state, onClose }) => {
  return state ? (
    <Popup
      fullWidth
      open={!!state}
      variant="custom"
      title={<div className="text-center">{TITLES[state]}</div>}
      actions={[]}
      onClose={onClose}
      maxWidth="xs"
      enableCloseOnBackdropClick={false}
      hideCloseButton
    >
      <div className="p-4 text-center">
        <div className="mb-12 mt-8">
          <Spinner size="large" className="flex justify-center" />
        </div>

        {DESCRIPTIONS[state] && <div className="text-sm text-muted-foreground">{DESCRIPTIONS[state]}</div>}
      </div>
    </Popup>
  ) : null;
};
