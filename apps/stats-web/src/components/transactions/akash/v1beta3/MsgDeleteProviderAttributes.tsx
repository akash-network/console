"use client";
import Link from "next/link";

import { LabelValue } from "../../../LabelValue";

import { DynamicReactJson } from "@/components/DynamicJsonView";
import { UrlService } from "@/lib/urlUtils";
import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgDeleteProviderAttributes: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Provider" value={<Link href={UrlService.address(message?.data?.owner)}>{message?.data?.owner}</Link>} />
      {/* TODO: Add link to provider page */}
      <LabelValue label="Auditor" value={<Link href={UrlService.address(message?.data?.auditor)}>{message?.data?.auditor}</Link>} />
      <LabelValue label="Keys" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.keys))} />} />
    </>
  );
};
