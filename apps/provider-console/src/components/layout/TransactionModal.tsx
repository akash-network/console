"use client";
import { ReactNode } from "react";
import { Popup, Spinner } from "@akashnetwork/ui/components";

type Props = {
  state: "waitingForApproval" | "broadcasting";
  open: boolean;
  onClose?: () => void;
  children?: ReactNode;
};

export const TransactionModal: React.FunctionComponent<Props> = ({ state, open, onClose }) => {
  return (
    <Popup
      fullWidth
      open={open}
      variant="custom"
      title={
        state === "waitingForApproval" ? <div className="text-center">Waiting for tx approval</div> : <div className="text-center">Transaction Pending</div>
      }
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

        <div className="text-sm text-muted-foreground">
          {state === "waitingForApproval" ? "APPROVE OR REJECT TX TO CONTINUE..." : "BROADCASTING TRANSACTION..."}
        </div>
      </div>
    </Popup>
  );
};
