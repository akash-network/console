import { TransactionMessage } from "@/types";
import { AddressLink } from "../../AddressLink";
import { AKTAmount } from "../../AKTAmount";
import { LabelValue } from "../../LabelValue";
import { coinsToAmount } from "@/lib/mathHelpers";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgUndelegate: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO missing auto claim reward + validator moniker
  // ###################
  return (
    <>
      <LabelValue label="Delegator Address" value={<AddressLink address={message?.data?.delegatorAddress} />} />
      <LabelValue label="Validator Address" value={<AddressLink address={message?.data?.validatorAddress} />} />
      <LabelValue label="Amount" value={<AKTAmount uakt={coinsToAmount(message?.data?.amount, "uakt")} showAKTLabel showUSD />} />
      {/* <MessageLabelValue
        label="Auto Claim Reward"
        value={
          <>
            {coinsToAmount(message?.data?.amount, "uakt", 6)}&nbsp;
            <AKTLabel />
          </>
        }
      /> */}
    </>
  );
};
