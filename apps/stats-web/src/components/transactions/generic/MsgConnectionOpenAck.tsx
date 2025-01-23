"use client";
import { AddressLink } from "../../AddressLink";
import { DynamicReactJson } from "../../DynamicJsonView";
import { LabelValue } from "../../LabelValue";

import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgConnectionOpenAck: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO missing everything
  // ###################
  return (
    <>
      <LabelValue label="@type" value={message?.data?.clientState?.typeUrl} />
      <LabelValue label="Connection Id" value={message?.data?.connectionId} />
      <LabelValue label="Counterparty Connection Id" value={message?.data?.counterpartyConnectionId} />
      <LabelValue label="Identifier" value={message?.data?.version?.identifier} />
      <LabelValue label="Features" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.version?.features))} />} />
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
      <LabelValue label="Proof Try" value={message?.data?.proofTry} />
      <LabelValue label="Proof Client" value={message?.data?.proofClient} />
      <LabelValue label="Proof Consensus" value={message?.data?.proofConsensus} />
      <LabelValue label="Signer" value={<AddressLink address={message?.data?.signer} />} />
    </>
  );
};
