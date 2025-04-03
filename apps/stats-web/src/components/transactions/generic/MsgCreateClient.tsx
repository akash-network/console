"use client";
import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

import type { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgCreateClient: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO missing Client Id, Client Type, Chain Id, Trusting Period, Unbonding Period, Timestamp
  // ###################
  return (
    <>
      <LabelValue label="Client Id" value={message?.data?.packet?.sequence} />
      <LabelValue label="Client Type" value={message?.data?.packet?.sequence} />
      <LabelValue label="Chain Id" value={message?.data?.packet?.sequence} />
      <LabelValue label="Trusting Period" value={message?.data?.packet?.sequence} />
      <LabelValue label="Unbonding Period" value={message?.data?.packet?.sequence} />
      <LabelValue label="Timestamp" value={message?.data?.packet?.sequence} />
      <LabelValue label="Signer" value={<AddressLink address={message?.data?.signer} />} />
    </>
  );
};
