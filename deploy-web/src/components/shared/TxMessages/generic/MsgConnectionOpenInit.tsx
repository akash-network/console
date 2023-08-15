import { TransactionMessage } from "@src/types";
import { AddressLink } from "../../AddressLink";
import { LabelValue } from "../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgConnectionOpenInit: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Client Id" value={message?.data?.clientId} />
      <LabelValue label="Counterparty Client Id" value={message?.data?.counterparty?.clientId} />
      <LabelValue label="Connection Id" value={message?.data?.counterparty?.connectionId} />
      <LabelValue label="Signer" value={<AddressLink address={message?.data?.signer} />} />
    </>
  );
};
