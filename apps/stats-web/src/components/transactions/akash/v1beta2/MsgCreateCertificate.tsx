import { LabelValue } from "../../../LabelValue";

import { AddressLink } from "@/components/AddressLink";
import { TransactionMessage } from "@/types";

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
