"use client";
import { AddressLink } from "../../AddressLink";
import { AKTAmount } from "../../AKTAmount";
import { LabelValue } from "../../LabelValue";

import { coinsToAmount } from "@/lib/mathHelpers";
import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgCreateValidator: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO minSelftDelegation as a coin + validator moniker
  // TODO commissions DecCoin
  // ###################

  return (
    <>
      <LabelValue label="Min Self Delegation" value={<AKTAmount uakt={message?.data?.minSelfDelegation} showAKTLabel showUSD />} />
      <LabelValue label="Delegator Address" value={<AddressLink address={message?.data?.delegatorAddress} />} />
      <LabelValue label="Validator Address" value={<AddressLink address={message?.data?.validatorAddress} />} />
      <LabelValue label="Value" value={<AKTAmount uakt={coinsToAmount(message?.data?.value, "uakt")} showAKTLabel showUSD />} />
      <LabelValue label="Details" value={message?.data?.description?.details} />
      <LabelValue label="Moniker" value={message?.data?.description?.moniker} />
      <LabelValue
        label="Website"
        value={
          <a href={message?.data?.description?.website} target="_blank">
            {message?.data?.description?.website}
          </a>
        }
      />
      <LabelValue label="Identity" value={message?.data?.description?.identity} />
      <LabelValue label="Security Contact" value={message?.data?.description?.securityContact} />
      <LabelValue label="Commission Rate" value={message?.data?.commission?.rate} />
      <LabelValue label="Commission Max Rate" value={message?.data?.commission?.maxRate} />
      <LabelValue label="Commission Max Change Rate" value={message?.data?.commission?.maxChangeRate} />
      <LabelValue label="Public Key" value={message?.data?.pubkey?.value} />
    </>
  );
};
