import { DynamicReactJson } from "../../DynamicJsonView";

import { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgChannelCloseInit: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return <DynamicReactJson src={JSON.parse(JSON.stringify(message.data))} />;
};
