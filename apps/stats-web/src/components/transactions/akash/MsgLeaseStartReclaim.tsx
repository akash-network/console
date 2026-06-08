"use client";
import Link from "next/link";

import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";

import { AddressLink } from "@/components/AddressLink";
import { formatLeaseCloseReason } from "@/lib/leaseCloseReason";
import { UrlService } from "@/lib/urlUtils";

export const MsgLeaseStartReclaim = createMsgView(["v1beta5"], ({ message }) => {
  const id = message?.data?.id;

  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={id?.owner} />} />
      <LabelValue label="dseq" value={<Link href={UrlService.deployment(id?.owner, id?.dseq)}>{id?.dseq}</Link>} />
      <LabelValue label="gseq" value={id?.gseq} />
      <LabelValue label="oseq" value={id?.oseq} />
      <LabelValue label="Provider" value={<Link href={UrlService.address(id?.provider)}>{id?.provider}</Link>} />
      <LabelValue label="Reason" value={formatLeaseCloseReason(message?.data?.reason)} />
    </>
  );
});
