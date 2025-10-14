"use client";

import { LabelValue } from "../../LabelValue";
import { createMsgView } from "../createMsgView";
import { DepositDetail } from "./helpers/DepositDetail";

import { AddressLink } from "@/components/AddressLink";
import { DynamicReactJson } from "@/components/DynamicJsonView";

export const MsgAccountDeposit = createMsgView(["v1"], ({ message }) => {
  const data = message?.data;
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={data?.signer} />} />
      <LabelValue label="Account" value={<DynamicReactJson src={JSON.parse(JSON.stringify(data?.account))} />} />
      <DepositDetail value={data?.deposit} />
    </>
  );
});
