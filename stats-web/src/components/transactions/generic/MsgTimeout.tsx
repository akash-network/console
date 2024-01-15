import { AddressLink } from "../../AddressLink";
import { DynamicReactJson } from "../../DynamicJsonView";
import { LabelValue } from "../../LabelValue";
import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgTimeout: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO missing IBC progress
  // ###################
  return (
    <>
      <LabelValue label="Sequence" value={message?.data?.packet?.sequence} />
      <LabelValue label="Source Port" value={message?.data?.packet?.sourcePort} />
      <LabelValue label="Source Channel" value={message?.data?.packet?.sourceChannel} />
      <LabelValue label="Destination Port" value={message?.data?.packet?.destinationPort} />
      <LabelValue label="Destination Channel" value={message?.data?.packet?.destinationChannel} />
      <LabelValue label="Data" value={<DynamicReactJson src={JSON.parse(Buffer.from(message?.data?.packet?.data, "base64").toString())} />} />
      <LabelValue label="Timeout Revision Number" value={message?.data?.packet?.timeoutHeight?.revisionNumber} />
      <LabelValue label="Timeout Revision Height" value={message?.data?.packet?.timeoutHeight?.revisionHeight} />
      <LabelValue label="Timeout Timestamp" value={message?.data?.packet?.timeoutTimestamp} />
      <LabelValue label="Proof Revision Number" value={message?.data?.proofHeight?.revisionHeight} />
      <LabelValue label="Proof Reivison Height" value={message?.data?.proofHeight?.revisionNumber} />
      <LabelValue label="Next Sequence Recv" value={message?.data?.nextSequenceRecv} />
      <LabelValue label="Signer" value={<AddressLink address={message?.data?.signer} />} />

      <LabelValue label="IBC Progress" value={message?.data?.packet?.destinationChannel} />
    </>
  );
};
