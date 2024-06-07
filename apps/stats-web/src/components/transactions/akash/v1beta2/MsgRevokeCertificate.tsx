import { LabelValue } from "../../../LabelValue";

import { AddressLink } from "@/components/AddressLink";
import { TransactionMessage } from "@/types";

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
