import { TransactionMessage } from "@src/types";
import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgChannelOpenAck: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Port Id" value={message?.data?.portId} />
      <LabelValue label="Channel Id" value={message?.data?.channelId} />
      <LabelValue label="Counterparty Channel Id" value={message?.data?.counterpartyVersion} />
      <LabelValue label="Counterparty Version" value={message?.data?.counterpartyVersion} />
      <LabelValue label="Proof Try" value={message?.data?.proofTry} />
      <LabelValue label="Revision Number" value={message?.data?.proofHeight?.revisionNumber} />
      <LabelValue label="Revision Height" value={message?.data?.proofHeight?.revisionHeight} />
      <LabelValue label="Signer" value={<AddressLink address={message?.data?.signer} />} />
    </>
  );
};
