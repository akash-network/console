import { BalanceHttpService } from "@akashnetwork/http-sdk";
import type { EncodeObject } from "@cosmjs/proto-signing";
import axios from "axios";
import createError from "http-errors";
import { singleton } from "tsyringe";

import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { isTxOutcomeError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { TxManagerService } from "@src/billing/services/tx-manager/tx-manager.service";

const ESCROW_SETTLEMENT_UNDERFLOW_MESSAGE = "negative decimal coin amount" as const;

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
    "account closed": {
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
    "invalid: deployment hash": {
      code: 400,
      message: "Invalid deployment hash"
    },
    "fee allowance expired": {
      code: 400,
      message: "Console trial expired"
    },
    "Deployment exists": {
      code: 400,
      message: "Deployment with provided dseq and owner already exists"
    },
    "Invalid Owner Address": {
      code: 400,
      message: "Invalid owner address"
    },
    "bid not open": {
      code: 400,
      message: "Cannot create lease: The selected bid is no longer open. Please refresh and select an available bid."
    },
    "order not open": {
      code: 400,
      message: "Cannot create lease: The associated order has already been matched or closed. Re-create the deployment to generate a new order and try again."
    },
    "invalid unit price": {
      code: 400,
      message: "Unit price exceeds the maximum allowed by the network"
    },
    "insufficient balance": {
      code: 402,
      message: "Not enough balance to cover the deployment deposit. Add credits or turn on auto recharge to continue."
    },
    [ESCROW_SETTLEMENT_UNDERFLOW_MESSAGE]: {
      code: 400,
      message: "Deployment escrow cannot be settled yet"
    }
  };

  private MESSAGE_ERROR_TITLES: Record<string, string> = {
    "/akash.deployment.v1beta4.MsgCreateDeployment": "Failed to create deployment",
    "/akash.market.v1beta5.MsgCreateLease": "Failed to create lease",
    "/akash.cert.v1.MsgCreateCertificate": "Failed to create certificate"
  };

  constructor(
    private readonly balanceHttpService: BalanceHttpService,
    private readonly billingConfigService: BillingConfigService,
    private readonly txManagerService: TxManagerService
  ) {}

  /** A signer-classified outcome passes through untouched: re-deriving a status from its message would erase whether the tx can still land. */
  public async toAppError(error: Error, messages: readonly EncodeObject[]) {
    if (isTxOutcomeError(error)) {
      return error;
    }

    const clues = Object.keys(this.ERRORS) as (keyof typeof this.ERRORS)[];

    const clue = clues.find(clue => error.message.toLowerCase().includes(clue.toLowerCase()));

    if (!clue) {
      const upstreamStatus = this.getUpstreamStatusFromCause(error);
      if (upstreamStatus) {
        return createError(upstreamStatus, error.message, { originalError: error });
      }

      return error;
    }

    const messagePrefix = this.getMessagePrefix(error, messages);

    const { message, code } = (await this.getBalanceError(clue, error)) || this.ERRORS[clue];
    const prefixedMessage = messagePrefix ? `${messagePrefix}: ${message}` : message;

    return createError(code, prefixedMessage, { originalError: error });
  }

  private getUpstreamStatusFromCause(error: Error): number | undefined {
    const { cause } = error;
    if (!axios.isAxiosError(cause) || !cause.response) {
      return undefined;
    }

    const status = cause.response.status;
    return status >= 500 ? status : undefined;
  }

  public isDeploymentClosedError(error: Error): boolean {
    return /account closed|deployment closed/i.test(error.message);
  }

  /** An index outside the batch is not resolved to a neighbour: closing the wrong deployment is worse than alerting. */
  public getClosedDeploymentMessageIndex(error: unknown, batchSize: number): number | undefined {
    if (!(error instanceof Error) || !this.isDeploymentClosedError(error)) {
      return undefined;
    }

    const messageIndex = this.getFailedMessageIndex(error);

    if (messageIndex !== undefined) {
      return messageIndex >= 0 && messageIndex < batchSize ? messageIndex : undefined;
    }

    return batchSize === 1 ? 0 : undefined;
  }

  /**
   * `toAppError` replaces the raw chain message with a mapped one, so on that path the index survives only
   * on `originalError`, which is read first because it is the rawest message available.
   */
  public getFailedMessageIndex(error: Error): number | undefined {
    const originalError = (error as { originalError?: unknown }).originalError;

    return this.parseMessageIndex(originalError instanceof Error ? originalError.message : undefined) ?? this.parseMessageIndex(error.message);
  }

  private parseMessageIndex(message: string | undefined): number | undefined {
    const match = message?.match(/message index: (\d+)/)?.[1];

    if (match === undefined) {
      return undefined;
    }

    const index = parseInt(match, 10);

    return Number.isNaN(index) ? undefined : index;
  }

  public isUnsettleableDeploymentError(error: Error): boolean {
    const originalError = (error as { originalError?: unknown }).originalError;
    const messages = [error.message, originalError instanceof Error ? originalError.message : undefined];
    return messages.some(message => message?.toLowerCase().includes(ESCROW_SETTLEMENT_UNDERFLOW_MESSAGE));
  }

  public async isMasterWalletInsufficientFundsError(error: Error) {
    if (!error.message.toLowerCase().includes("insufficient funds")) return false;

    const masterWalletAddress = await this.txManagerService.getFundingWalletAddress();
    const masterWalletBalance = await this.balanceHttpService.getBalance(masterWalletAddress, this.billingConfigService.get("DEPLOYMENT_GRANT_DENOM"));
    const insufficientFundsErrorData = this.parseInsufficientFundsErrorMessage(error.message);

    if (!insufficientFundsErrorData) return false;

    return !masterWalletBalance || masterWalletBalance.amount < insufficientFundsErrorData.requiredAmount;
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
      .map(denom => RegExp.escape(denom))
      .join("|");

    const pattern = new RegExp(`(\\d+)(uakt|uact|${usdcDenoms}) is smaller than (\\d+)\\2`);

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
    const messageIndex = this.getFailedMessageIndex(error);

    if (messageIndex === undefined) {
      return "";
    }

    const messageType = messages[messageIndex]?.typeUrl;

    if (!messageType) {
      return "";
    }

    return messageType in this.MESSAGE_ERROR_TITLES ? this.MESSAGE_ERROR_TITLES[messageType] : "";
  }
}
