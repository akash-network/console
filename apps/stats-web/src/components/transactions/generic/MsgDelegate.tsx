import Link from "next/link";

import { AddressLink } from "../../AddressLink";
import { AKTAmount } from "../../AKTAmount";
import { LabelValue } from "../../LabelValue";

import { coinsToAmount } from "@/lib/mathHelpers";
import { UrlService } from "@/lib/urlUtils";
import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgDelegate: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO missing auto claim reward + validator moniker
  // ###################

  return (
    <>
      <LabelValue label="Delegator Address" value={<AddressLink address={message?.data?.delegatorAddress} />} />
      <LabelValue
        label="Validator Address"
        value={<Link href={UrlService.validator(message?.data?.validatorAddress)}>{message?.data?.validatorAddress}</Link>}
      />
      <LabelValue label="Amount" value={<AKTAmount uakt={coinsToAmount(message?.data?.amount, "uakt")} showAKTLabel showUSD />} />
      {/* TODO: Add auto claim reward */}
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
