"use client";
import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";

import { AddressLink } from "@/components/AddressLink";

export const MsgCreateCertificate = createMsgView(["v1beta1", "v1beta2", "v1beta3", "v1"], ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.owner} />} />
      <LabelValue label="Cert" value={message?.data?.cert} />
      <LabelValue label="Pubkey" value={message?.data?.pubkey} />
    </>
  );
});
