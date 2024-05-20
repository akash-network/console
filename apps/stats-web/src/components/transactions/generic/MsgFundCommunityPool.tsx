import { TransactionMessage } from "@/types";
import { AddressLink } from "../../AddressLink";
import { AKTAmount } from "../../AKTAmount";
import { LabelValue } from "../../LabelValue";
import { coinsToAmount } from "@/lib/mathHelpers";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgFundCommunityPool: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Amount" value={<AKTAmount uakt={coinsToAmount(message?.data?.amount, "uakt")} showAKTLabel showUSD />} />
      <LabelValue label="Depositor" value={<AddressLink address={message?.data?.depositor} />} />
    </>
  );
};
