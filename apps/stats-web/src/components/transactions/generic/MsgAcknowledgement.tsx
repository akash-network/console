"use client";
import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgAcknowledgement: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO missing Amount, Origin Amount, Origin Denom, Sender, Effected
  // ###################
  return (
    <>
      <LabelValue label="Sequence" value={message?.data?.packet?.sequence} />
      {/* <MessageLabelValue label="Amount" value={"TODO"} />
      <MessageLabelValue label="Origin Amount" value={"TODO"} />
      <MessageLabelValue label="Origin Denom" value={"TODO"} />
      <MessageLabelValue label="Receiver" value={"TODO"} />
      <MessageLabelValue label="Sender" value={"TODO"} /> */}
      <LabelValue label="Source Port" value={message?.data?.packet?.sourcePort} />
      <LabelValue label="Source Channel" value={message?.data?.packet?.sourceChannel} />
      <LabelValue label="Destination Port" value={message?.data?.packet?.destinationPort} />
      <LabelValue label="Destination Channel" value={message?.data?.packet?.destinationChannel} />
      <LabelValue label="Signer" value={<AddressLink address={message?.data?.signer} />} />
      {/* <LabelValue label="Effected" value={message?.data?.clientId} /> */}
    </>
  );
};
