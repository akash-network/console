"use client";
import Link from "next/link";

import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";
import { DepositDetail } from "./helpers/DepositDetail";

import { AddressLink } from "@/components/AddressLink";
import { DynamicReactJson } from "@/components/DynamicJsonView";
import { UrlService } from "@/lib/urlUtils";

export const MsgCreateDeployment = createMsgView(["v1beta1", "v1beta2", "v1beta3", "v1beta4"], ({ message }) => {
  // ###################
  // TODO group resources from base 64
  // ###################

  const data = message?.data;

  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={data?.id?.owner} />} />
      <LabelValue label="dseq" value={<Link href={UrlService.deployment(data?.id?.owner, data?.id?.dseq)}>{data?.id?.dseq}</Link>} />
      <LabelValue label="Version" value={data?.hash || data?.version} />
      {data?.depositor && <LabelValue label="Depositor" value={<Link href={UrlService.address(data?.depositor)}>{data?.depositor}</Link>} />}
      <DepositDetail value={data?.deposit} />
      <LabelValue label="Groups" value={<DynamicReactJson src={JSON.parse(JSON.stringify(data?.groups))} />} />
    </>
  );
});
