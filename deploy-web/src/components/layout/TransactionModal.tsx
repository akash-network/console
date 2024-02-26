"use client";
import { ReactNode } from "react";
import { Popup } from "../shared/Popup";
import Spinner from "../shared/Spinner";

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
      title={state === "waitingForApproval" ? <>Waiting for tx approval</> : <>Transaction Pending</>}
      actions={[]}
      onClose={onClose}
      maxWidth="xs"
      enableCloseOnBackdropClick={false}
    >
      <div className="p-4 text-center">
        <div className="mb-12 mt-8">
          <Spinner size="large" className="justify-center" />
        </div>

        <div className="text-sm text-muted-foreground">
          {state === "waitingForApproval" ? "APPROVE OR REJECT TX TO CONTINUE..." : "BROADCASTING TRANSACTION..."}
        </div>
      </div>
    </Popup>
  );
};
