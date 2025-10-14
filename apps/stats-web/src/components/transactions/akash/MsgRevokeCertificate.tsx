"use client";
import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";

import { AddressLink } from "@/components/AddressLink";

export const MsgRevokeCertificate = createMsgView(["v1beta1", "v1beta2", "v1beta3", "v1"], ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.id?.owner} />} />
      <LabelValue label="Serial" value={message?.data?.id?.serial} />
    </>
  );
});
