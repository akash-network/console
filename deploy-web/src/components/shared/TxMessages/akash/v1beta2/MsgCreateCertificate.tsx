import { AddressLink } from "@src/components/shared/AddressLink";
import { TransactionMessage } from "@src/types";
import { LabelValue } from "../../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgCreateCertificate: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.owner} />} />
      <LabelValue label="Cert" value={message?.data?.cert} />
      <LabelValue label="Pubkey" value={message?.data?.pubkey} />
    </>
  );
};
