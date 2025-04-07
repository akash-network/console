"use client";
import Link from "next/link";

import { LabelValue } from "../../../LabelValue";

import { AddressLink } from "@/components/AddressLink";
import { UrlService } from "@/lib/urlUtils";
import type { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgUpdateDeployment: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.id?.owner} />} />
      <LabelValue label="dseq" value={<Link href={UrlService.deployment(message?.data?.id?.owner, message?.data?.id?.dseq)}>{message?.data?.id?.dseq}</Link>} />
      <LabelValue label="Version" value={message?.data?.version} />
    </>
  );
};
