import { TransactionMessage } from "@/types";
import { AddressLink } from "../../AddressLink";
import { DynamicReactJson } from "../../DynamicJsonView";
import { LabelValue } from "../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgChannelOpenTry: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Port Id" value={message?.data?.portId} />
      <LabelValue label="Previous Channel Id" value={message?.data?.previousChannelId} />
      <LabelValue label="State" value={message?.data?.channel?.state} />
      <LabelValue label="Ordering" value={message?.data?.channel?.ordering} />
      <LabelValue label="Channel Id" value={message?.data?.channel?.counterparty?.channelId} />
      <LabelValue label="Connection Hops" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.channel?.connectionHops))} />} />
      <LabelValue label="Version" value={message?.data?.channel?.version} />
      <LabelValue label="Counterparty Version" value={message?.data?.counterpartyVersion} />
      <LabelValue label="Proof Init" value={message?.data?.proofInit} />
      <LabelValue label="Revision Number" value={message?.data?.proofHeight?.revisionNumber} />
      <LabelValue label="Revision Height" value={message?.data?.proofHeight?.revisionHeight} />
      <LabelValue label="Signer" value={<AddressLink address={message?.data?.signer} />} />
    </>
  );
};
