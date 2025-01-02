import type { EncodeObject } from "@cosmjs/proto-signing";
import createError from "http-errors";
import { singleton } from "tsyringe";

@singleton()
export class ChainErrorService {
  private readonly ERRORS = {
    "insufficient funds": {
      code: 400,
      message: "Insufficient funds"
    },
    "Deposit too low": {
      code: 400,
      message: "Deposit too low"
    }
  };

  private MESSAGE_ERROR_TITLES: Record<string, string> = {
    "/akash.deployment.v1beta3.MsgCreateDeployment": "Failed to create deployment",
    "/akash.market.v1beta4.MsgCreateLease": "Failed to create lease"
  };

  public toAppError(error: Error, messages: readonly EncodeObject[]) {
    const clues = Object.keys(this.ERRORS) as (keyof typeof this.ERRORS)[];

    const clue = clues.find(clue => error.message.includes(clue));

    if (!clue) {
      return error;
    }

    const messagePrefix = this.getMessagePrefix(error, messages);
    const { message, code } = this.ERRORS[clue];
    const prefixedMessage = messagePrefix ? `${messagePrefix}: ${message}` : message;

    return createError(code, prefixedMessage, { originalError: error });
  }

  private getMessagePrefix(error: Error, messages: readonly EncodeObject[]) {
    const messageIndexStr = error.message.match(/message index: (\d+)/)?.[1];
    if (!messageIndexStr) {
      return "";
    }

    const messageIndex = parseInt(messageIndexStr);
    const messageType = messages[messageIndex]?.typeUrl;

    if (!messageType) {
      return "";
    }

    return messageType in this.MESSAGE_ERROR_TITLES ? this.MESSAGE_ERROR_TITLES[messageType] : "";
  }
}
