"use client";
import Link from "next/link";

import { LabelValue } from "../../../LabelValue";

import { AddressLink } from "@/components/AddressLink";
import { UrlService } from "@/lib/urlUtils";
import type { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgCloseBid: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Provider" value={<Link href={UrlService.address(message?.data?.bidId?.provider)}>{message?.data?.bidId?.provider}</Link>} />
      {/* TODO: Add link to provider page */}
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.bidId?.owner} />} />
      <LabelValue
        label="dseq"
        value={<Link href={UrlService.deployment(message?.data?.bidId?.owner, message?.data?.bidId?.dseq)}>{message?.data?.bidId?.dseq}</Link>}
      />
      <LabelValue label="gseq" value={message?.data?.bidId?.gseq} />
      <LabelValue label="oseq" value={message?.data?.bidId?.oseq} />
    </>
  );
};
