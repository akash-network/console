"use client";
import Link from "next/link";

import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";

import { AddressLink } from "@/components/AddressLink";
import { UrlService } from "@/lib/urlUtils";

export const MsgCreateLease = createMsgView(["v1beta1", "v1beta2", "v1beta3", "v1beta4", "v1beta5"], ({ message }) => {
  const bidId = message?.data?.id || message?.data?.bidId;
  return (
    <>
      <LabelValue label="Provider" value={<Link href={UrlService.address(bidId?.provider)}>{bidId?.provider}</Link>} />
      {/* TODO: Add link to provider page */}
      <LabelValue label="Owner" value={<AddressLink address={bidId?.owner} />} />
      <LabelValue label="dseq" value={<Link href={UrlService.deployment(bidId?.owner, bidId?.dseq)}>{bidId?.dseq}</Link>} />
      <LabelValue label="gseq" value={bidId?.gseq} />
      <LabelValue label="oseq" value={bidId?.oseq} />
    </>
  );
});
