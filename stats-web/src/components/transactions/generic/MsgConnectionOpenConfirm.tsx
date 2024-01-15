import { TransactionMessage } from "@/types";
import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgConnectionOpenConfirm: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  // ###################
  // TODO missing everything
  // ###################
  return (
    <>
      <LabelValue label="Connection Id" value={message?.data?.connectionId} />
      <LabelValue label="Proof Ack" value={message?.data?.proofAck} />
      <LabelValue label="Revision Number" value={message?.data?.proofHeight?.revisionNumber} />
      <LabelValue label="Revision Height" value={message?.data?.proofHeight?.revisionHeight} />
      <LabelValue label="Signer" value={<AddressLink address={message?.data?.signer} />} />
    </>
  );
};
