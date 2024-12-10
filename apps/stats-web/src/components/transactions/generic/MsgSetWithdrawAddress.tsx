import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgSetWithdrawAddress: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Delegator Address" value={<AddressLink address={message?.data?.delegatorAddress} />} />
      <LabelValue label="Withdraw Address" value={<AddressLink address={message?.data?.withdrawAddress} />} />
    </>
  );
};
