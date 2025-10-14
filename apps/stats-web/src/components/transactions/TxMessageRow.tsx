"use client";
import { DynamicReactJson } from "../DynamicJsonView";
import * as akashMessages from "./akash";
import * as cosmosMessages from "./generic";

import { useFriendlyMessageType } from "@/hooks/useFriendlyMessageType";
import type { TransactionMessage } from "@/types";

type Props = {
  message: TransactionMessage;
};

export const TxMessageRow: React.FunctionComponent<Props> = ({ message }) => {
  const friendlyType = useFriendlyMessageType(message.type);

  return (
    <div>
      <div className="mb-4 border-b border-b-muted-foreground/10 p-4 text-muted-foreground">{friendlyType}</div>

      <div className="break-all px-4 pb-4 pt-0">
        <TxMessage message={message} />
      </div>
    </div>
  );
};

type TxMessageProps = {
  message: TransactionMessage;
};
const TxMessage: React.FunctionComponent<TxMessageProps> = ({ message }) => {
  const [namespace, ...typeDetails] = message.type.split(".");
  const version = typeDetails[typeDetails.length - 2];
  const name = typeDetails[typeDetails.length - 1];
  let MsgComponent: React.FunctionComponent<TxMessageProps & { version: string }>;

  if (namespace === "/cosmos" && cosmosMessages[name]) {
    MsgComponent = cosmosMessages[name];
  } else if (namespace === "/akash" && akashMessages[name]) {
    MsgComponent = akashMessages[name];
  }

  if (!MsgComponent) {
    return <DynamicReactJson src={JSON.parse(JSON.stringify(message?.data))} />;
  }

  return <MsgComponent message={message} version={version} />;
};
