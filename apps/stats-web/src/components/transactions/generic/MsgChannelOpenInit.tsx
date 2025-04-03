"use client";
import { AddressLink } from "../../AddressLink";
import { DynamicReactJson } from "../../DynamicJsonView";
import { LabelValue } from "../../LabelValue";

import type { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgChannelOpenInit: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Port Id" value={message?.data?.portId} />
      <LabelValue label="State" value={message?.data?.channel?.state} />
      <LabelValue label="Ordering" value={message?.data?.channel?.ordering} />
      <LabelValue label="Channel Id" value={message?.data?.channel?.counterparty?.channelId} />
      <LabelValue label="Connection Hops" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.channel?.connectionHops))} />} />
      <LabelValue label="Version" value={message?.data?.channel?.version} />
      <LabelValue label="Signer" value={<AddressLink address={message?.data?.signer} />} />
    </>
  );
};
