import { AddressLink } from "@src/components/shared/AddressLink";
import { DynamicReactJson } from "@src/components/shared/DynamicJsonView";
import { TransactionMessage } from "@src/types";
import { LabelValue } from "../../../LabelValue";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgUpdateProvider: React.FunctionComponent<TxMessageProps> = ({ message }) => {
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
