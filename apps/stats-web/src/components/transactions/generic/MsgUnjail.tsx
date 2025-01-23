"use client";
import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgUnjail: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Validator Address" value={<AddressLink address={message?.data?.validatorAddr} />} />
    </>
  );
};
