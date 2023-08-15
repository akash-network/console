import { TransactionMessage } from "@src/types";
import { DynamicReactJson } from "../../DynamicJsonView";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgTimeoutOnClose: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return <DynamicReactJson src={JSON.parse(JSON.stringify(message.data))} />;
};
