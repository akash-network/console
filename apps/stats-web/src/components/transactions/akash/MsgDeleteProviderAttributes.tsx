"use client";
import Link from "next/link";

import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";

import { DynamicReactJson } from "@/components/DynamicJsonView";
import { UrlService } from "@/lib/urlUtils";

export const MsgDeleteProviderAttributes = createMsgView(["v1beta1", "v1beta2", "v1beta3", "v1"], ({ message }) => {
  return (
    <>
      <LabelValue label="Provider" value={<Link href={UrlService.address(message?.data?.owner)}>{message?.data?.owner}</Link>} />
      {/* TODO: Add link to provider page */}
      <LabelValue label="Auditor" value={<Link href={UrlService.address(message?.data?.auditor)}>{message?.data?.auditor}</Link>} />
      <LabelValue label="Keys" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.keys))} />} />
    </>
  );
});
