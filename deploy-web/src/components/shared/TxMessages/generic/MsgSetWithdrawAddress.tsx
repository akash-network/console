import { TransactionMessage } from "@src/types";
import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgSetWithdrawAddress: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Delegator Adrress" value={<AddressLink address={message?.data?.delegatorAddress} />} />
      <LabelValue label="Withdraw Address" value={<AddressLink address={message?.data?.withdrawAddress} />} />
    </>
  );
};
