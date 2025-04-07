"use client";
import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

import type { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgConnectionOpenTry: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO missing everything
  // ###################
  return (
    <>
      <LabelValue label="@type" value={message?.data?.clientState?.typeUrl} />
      <LabelValue label="Client Id" value={message?.data?.clientId} />
      <LabelValue label="Previous Connection Id" value={message?.data?.previoudConnectionId} />
      {/* <MessageLabelValue label="Chain Id" value={"TODO"} />
      <MessageLabelValue label="Numerator" value={"TODO"} />
      <MessageLabelValue label="Denominator" value={"TODO"} />
      <MessageLabelValue label="Trusting Period" value={"TODO"} />
      <MessageLabelValue label="Unbonding Period" value={"TODO"} />
      <MessageLabelValue label="Max Clock Drift" value={"TODO"} /> */}
      <LabelValue label="Revision Number" value={message?.data?.proofHeight?.revisionNumber} />
      <LabelValue label="Revision Height" value={message?.data?.proofHeight?.revisionHeight} />
      {/* <MessageLabelValue label="Proof Specs" value={"TODO"} />
      <MessageLabelValue label="Upgrade Path" value={"TODO"} />
      <MessageLabelValue label="Allow Update After Expiry" value={"TODO"} />
      <MessageLabelValue label="Allow Update After Misbehaviour" value={"TODO"} /> */}
      <LabelValue label="Connection Id" value={message?.data?.counterparty?.connectionId} />
      <LabelValue label="Key Prefix" value={message?.data?.counterparty?.prefix?.keyPrefix} />
      <LabelValue label="Delay Period" value={message?.data?.delayPeriod} />
      {/* <MessageLabelValue label="Counterparty Versions" value={"TODO"} />
      <MessageLabelValue label="Proof Init" value={"TODO"} />
      <MessageLabelValue label="Proof Client" value={"TODO"} /> */}
      <LabelValue label="Proof Consensus" value={message?.data?.proofConsensus} />
      <LabelValue label="Signer" value={<AddressLink address={message?.data?.signer} />} />
    </>
  );
};
