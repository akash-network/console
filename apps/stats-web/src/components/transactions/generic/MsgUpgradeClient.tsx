"use client";
import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

import type { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgUpgradeClient: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO missing everything
  // ###################
  return (
    <>
      <LabelValue label="@type" value={message?.data?.consensusState?.typeUrl} />
      {/* <MessageLabelValue label="Client Id" value={"TODO"} />
      <MessageLabelValue label="Chain Id" value={"TODO"} />
      <MessageLabelValue label="Numerator" value={"TODO"} />
      <MessageLabelValue label="Denominator" value={"TODO"} />
      <MessageLabelValue label="Trusting Period" value={"TODO"} />
      <MessageLabelValue label="Unbonding Period" value={"TODO"} />
      <MessageLabelValue label="Max Clock Drift" value={"TODO"} />
      <MessageLabelValue label="Revision Number" value={"TODO"} />
      <MessageLabelValue label="Revision Height" value={"TODO"} />
      <MessageLabelValue label="Proof Specs" value={"TODO"} />
      <MessageLabelValue label="Upgrade Path" value={"TODO"} />
      <MessageLabelValue label="Allow Update After Expiry" value={"TODO"} />
      <MessageLabelValue label="Allow Update After Misbehaviour" value={"TODO"} />
      <MessageLabelValue label="Timestamp" value={"TODO"} />
      <MessageLabelValue label="Hash" value={"TODO"} />
      <MessageLabelValue label="Next Validators Hash" value={"TODO"} /> */}
      <LabelValue label="Proof Upgrade Client" value={message?.data?.proofUpgradeClient} />
      <LabelValue label="Proof Upgrade Consensus State" value={message?.data?.proofUpgradeConsensusState} />
      <LabelValue label="Signer" value={<AddressLink address={message?.data?.signer} />} />
    </>
  );
};
