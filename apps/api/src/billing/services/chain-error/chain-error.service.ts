import { BalanceHttpService } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { Wallet } from "@src/billing/lib/wallet/wallet";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";

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
    },
    "Deployment closed": {
      code: 400,
      message: "Deployment closed"
    },
    "invalid coin denominations": {
      code: 400,
      message: "Invalid coin denominations"
    },
    "invalid gpu attributes": {
      code: 400,
      message: "Invalid GPU attributes"
    },
    "invalid: deployment version": {
      code: 400,
      message: "Invalid deployment version"
    },
    "fee allowance expired": {
      code: 400,
      message: "Console trial expired"
    },
    "Deployment exists": {
      code: 400,
      message: "Deployment with provided dseq and owner already exists"
    }
  };

  private MESSAGE_ERROR_TITLES: Record<string, string> = {
    "/akash.deployment.v1beta3.MsgCreateDeployment": "Failed to create deployment",
    "/akash.market.v1beta4.MsgCreateLease": "Failed to create lease"
  };

  constructor(
    private readonly balanceHttpService: BalanceHttpService,
    private readonly billingConfigService: BillingConfigService,
    @InjectWallet("MANAGED") private readonly masterWallet: Wallet
  ) {}

  public async toAppError(error: Error, messages: readonly EncodeObject[]) {
    const clues = Object.keys(this.ERRORS) as (keyof typeof this.ERRORS)[];

    const clue = clues.find(clue => error.message.toLowerCase().includes(clue.toLowerCase()));

    if (!clue) {
      return error;
    }

    const messagePrefix = this.getMessagePrefix(error, messages);

    const { message, code } = (await this.getBalanceError(clue, error)) || this.ERRORS[clue];
    const prefixedMessage = messagePrefix ? `${messagePrefix}: ${message}` : message;

    return createError(code, prefixedMessage, { originalError: error });
  }

  public async isMasterWalletInsufficientFundsError(error: Error) {
    if (!error.message.toLowerCase().includes("insufficient funds")) return false;

    const masterWalletAddress = await this.masterWallet.getFirstAddress();
    const masterWalletBalance = await this.balanceHttpService.getBalance(masterWalletAddress, this.billingConfigService.get("DEPLOYMENT_GRANT_DENOM"));
    const insufficientFundsErrorData = this.parseInsufficientFundsErrorMessage(error.message);

    return masterWalletBalance.amount < insufficientFundsErrorData?.requiredAmount;
  }

  private async getBalanceError(clue: string, error: Error) {
    if (clue !== "insufficient funds") return;

    if (await this.isMasterWalletInsufficientFundsError(error)) {
      return {
        code: 503,
        message: "Service temporarily unavailable"
      };
    }
  }

  private parseInsufficientFundsErrorMessage(message: string): {
    availableAmount: number;
    requiredAmount: number;
    denom: string;
  } | null {
    const usdcDenoms = Object.values(this.billingConfigService.get("USDC_IBC_DENOMS"))
      .map(denom => denom.replace(/\//g, "\\/"))
      .join("|");

    const pattern = new RegExp(`(\\d+)(uakt|${usdcDenoms}) is smaller than (\\d+)\\2`);

    const match = message.match(pattern);

    if (!match) {
      return null;
    }

    return {
      availableAmount: parseInt(match[1], 10),
      requiredAmount: parseInt(match[3], 10),
      denom: match[2]
    };
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
