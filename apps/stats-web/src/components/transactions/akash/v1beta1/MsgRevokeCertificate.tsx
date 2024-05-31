import { TransactionMessage } from "@/types";
import { AddressLink } from "@/components/AddressLink";
import { LabelValue } from "../../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgRevokeCertificate: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.id?.owner} />} />
      <LabelValue label="Serial" value={message?.data?.id?.serial} />
    </>
  );
};
