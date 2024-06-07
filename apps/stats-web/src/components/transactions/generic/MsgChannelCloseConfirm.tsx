import { DynamicReactJson } from "../../DynamicJsonView";

import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgChannelCloseConfirm: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return <DynamicReactJson src={JSON.parse(JSON.stringify(message.data))} />;
};
