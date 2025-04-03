"use client";
import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

import type { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgWithdrawValidatorCommission: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO Missing amount + validator moniker
  // ###################
  return (
    <>
      <LabelValue label="Validator Address" value={<AddressLink address={message?.data?.validatorAddress} />} />
      {/* <MessageLabelValue label="Amount" value={"TODO"} /> */}
    </>
  );
};
