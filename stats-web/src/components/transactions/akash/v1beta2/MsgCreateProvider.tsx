import { TransactionMessage } from "@/types";
import { AddressLink } from "@/components/AddressLink";
import { LabelValue } from "../../../LabelValue";
import { DynamicReactJson } from "@/components/DynamicJsonView";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgCreateProvider: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return (
    <>
      <LabelValue label="Owner" value={<AddressLink address={message?.data?.owner} />} />
      <LabelValue label="Host Uri" value={message?.data?.hostUri} />
      <LabelValue label="Attributes" value={<DynamicReactJson src={JSON.parse(JSON.stringify(message?.data?.attributes))} />} />
      <LabelValue label="Email" value={message?.data?.info?.email} />
      <LabelValue label="Website" value={message?.data?.info?.website} />
    </>
  );
};
