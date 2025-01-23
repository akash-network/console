"use client";
import Link from "next/link";

import { LabelValue } from "../../../LabelValue";

import { AddressLink } from "@/components/AddressLink";
import { AKTAmount } from "@/components/AKTAmount";
import { coinsToAmount } from "@/lib/mathHelpers";
import { UrlService } from "@/lib/urlUtils";
import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgCreateBid: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Provider" value={<Link href={UrlService.address(message?.data?.provider)}>{message?.data?.provider}</Link>} />
      {/* TODO: Add link to provider page */}
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.order?.owner} />} />
      <LabelValue
        label="dseq"
        value={<Link href={UrlService.deployment(message?.data?.order?.owner, message?.data?.order?.dseq)}>{message?.data?.order?.dseq}</Link>}
      />
      <LabelValue label="gseq" value={message?.data?.order?.gseq} />
      <LabelValue label="oseq" value={message?.data?.order?.oseq} />
      <LabelValue label="Price" value={<AKTAmount uakt={coinsToAmount(message?.data?.price, "uakt")} showAKTLabel showUSD />} />
      <LabelValue label="Deposit" value={<AKTAmount uakt={coinsToAmount(message?.data?.deposit, "uakt")} showAKTLabel showUSD />} />
    </>
  );
};
