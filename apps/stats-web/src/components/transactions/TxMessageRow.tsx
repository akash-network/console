import { useMemo } from "react";

import { DynamicReactJson } from "../DynamicJsonView";
import * as akashMessages from "./akash";
import * as cosmosMessages from "./generic";

import { useFriendlyMessageType } from "@/hooks/useFriendlyMessageType";
import type { TransactionMessage } from "@/types";

type MessageComponent = React.FunctionComponent<TxMessageProps & { version: string }>;

const cosmosMessagesMap = cosmosMessages as Record<string, MessageComponent>;
const akashMessagesMap = akashMessages as Record<string, MessageComponent>;

function snakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function convertKeysToCamelCase(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  }

  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj as Record<string, unknown>).map(([key, value]) => [snakeToCamelCase(key), convertKeysToCamelCase(value)]));
  }

  return obj;
}

type Props = {
  message: TransactionMessage;
};

export const TxMessageRow: React.FunctionComponent<Props> = ({ message }) => {
  const friendlyType = useFriendlyMessageType(message.type);
  const normalizedMessage = useMemo(
    () => ({
      ...message,
      data: message.data ? convertKeysToCamelCase(message.data) : message.data
    }),
    [message]
  );

  return (
    <div>
      <div className="mb-4 border-b border-b-muted-foreground/10 p-4 text-muted-foreground">{friendlyType}</div>

      <div className="break-all px-4 pb-4 pt-0">
        <TxMessage message={normalizedMessage as TransactionMessage} />
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
  let MsgComponent: MessageComponent | undefined;

  if (namespace === "/cosmos" && cosmosMessagesMap[name]) {
    MsgComponent = cosmosMessagesMap[name];
  } else if (namespace === "/akash" && akashMessagesMap[name]) {
    MsgComponent = akashMessagesMap[name];
  }

  if (!MsgComponent) {
    return <DynamicReactJson src={JSON.parse(JSON.stringify(message?.data))} />;
  }

  return <MsgComponent message={message} version={version} />;
};
