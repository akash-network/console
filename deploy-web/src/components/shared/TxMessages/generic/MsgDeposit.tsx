import { TransactionMessage } from "@src/types";
import { coinsToAmount } from "@src/utils/mathHelpers";
import { AddressLink } from "../../AddressLink";
import { AKTAmount } from "../../AKTAmount";
import { LabelValue } from "../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgDeposit: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO Missing Validator
  // ###################
  return (
    <>
      <LabelValue label="Proposal Id" value={<AddressLink address={message?.data?.proposalId} />} />
      <LabelValue label="Depositor Address" value={<AddressLink address={message?.data?.depositor} />} />
      <LabelValue label="Amount" value={<AKTAmount uakt={coinsToAmount(message?.data?.amount, "uakt")} showAKTLabel showUSD />} />
    </>
  );
};
