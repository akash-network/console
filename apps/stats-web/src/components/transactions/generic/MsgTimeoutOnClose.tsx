"use client";
import { DynamicReactJson } from "../../DynamicJsonView";

import type { TransactionMessage } from "@/types";

type TxMessageProps = {
  message: TransactionMessage;
};

export const MsgTimeoutOnClose: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  return <DynamicReactJson src={JSON.parse(JSON.stringify(message.data))} />;
};
