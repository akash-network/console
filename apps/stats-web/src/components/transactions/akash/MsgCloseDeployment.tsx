"use client";
import Link from "next/link";

import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";

import { AddressLink } from "@/components/AddressLink";
import { UrlService } from "@/lib/urlUtils";

export const MsgCloseDeployment = createMsgView(["v1beta1", "v1beta2", "v1beta3", "v1beta4"], ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.id?.owner} />} />
      <LabelValue label="dseq" value={<Link href={UrlService.deployment(message?.data?.id?.owner, message?.data?.id?.dseq)}>{message?.data?.id?.dseq}</Link>} />
    </>
  );
});
