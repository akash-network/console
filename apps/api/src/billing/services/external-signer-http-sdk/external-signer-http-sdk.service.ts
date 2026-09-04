import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate";
import type { AxiosError } from "axios";
import axios from "axios";
import { inject, singleton } from "tsyringe";

import type { SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { TxNotIncludedError, type TxOutcome, TxOutcomeUnknownError } from "./tx-outcome.error";

type SignAndBroadcastRequestMessage = {
  typeUrl: string;
  value: string;
};

type SignAndBroadcastFundingRequest = {
  data: {
    messages: SignAndBroadcastRequestMessage[];
  };
};

type SignAndBroadcastDerivedRequest = {
  data: {
    derivationIndex: number;
    messages: SignAndBroadcastRequestMessage[];
    options?: SignAndBroadcastOptions;
  };
};

type SignAndBroadcastResponse = {
  data: Pick<IndexedTx, "code" | "hash" | "rawLog">;
};

/**
 * The signer attaches an outcome to every answer of its own, so a bare gateway timeout is an intermediary giving up on
 * a signer still at work. 502 and 503 are deliberately absent: the signer maps an unreachable chain node onto those,
 * and reading them as undecided would hold funding claims over every RPC blip.
 */
const UNDECIDED_UPSTREAM_STATUS = 504;

/**
 * Transport failures that can strike a request the signer already received. A refused connection or an unresolved
 * host is not among them: nothing reached the signer, so nothing was broadcast.
 */
const UNDECIDED_TRANSPORT_CODES = new Set(["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "EPIPE"]);

@singleton()
export class ExternalSignerHttpSdkService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly billingConfigService: BillingConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger,
    @inject(TYPE_REGISTRY) private readonly registry: Registry
  ) {
    this.logger = createLogger({ context: ExternalSignerHttpSdkService.name });
  }

  async signAndBroadcastWithFundingWallet(messages: readonly EncodeObject[]) {
    const response = await this.post<SignAndBroadcastResponse>("/v1/tx/funding", {
      data: {
        messages: this.encodeMessages(messages)
      }
    } satisfies SignAndBroadcastFundingRequest);
    return response.data;
  }

  async signAndBroadcastWithDerivedWallet(derivationIndex: number, messages: readonly EncodeObject[], options?: SignAndBroadcastOptions) {
    const response = await this.post<SignAndBroadcastResponse>("/v1/tx/derived", {
      data: {
        derivationIndex,
        messages: this.encodeMessages(messages),
        options
      }
    } satisfies SignAndBroadcastDerivedRequest);
    return response.data;
  }

  private encodeMessages(messages: readonly EncodeObject[]): SignAndBroadcastRequestMessage[] {
    return messages.map(message => ({
      typeUrl: message.typeUrl,
      value: Buffer.from(this.registry.encode(message)).toString("base64")
    }));
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const baseUrl = this.billingConfigService.get("TX_SIGNER_BASE_URL");
    const url = new URL(path, baseUrl).toString();
    try {
      const response = await axios.post<T>(url, body, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.billingConfigService.get("TX_SIGNER_API_KEY")
        },
        timeout: this.billingConfigService.get("TX_SIGNER_REQUEST_TIMEOUT_MS")
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = this.getErrorMessage(error.response?.data, error.message);
        this.logger.error({ event: "TX_SIGNER_REQUEST_FAILED", status: error.response?.status, message });
        throw this.toTxOutcomeError(error) ?? new Error(message, { cause: error });
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error({ event: "TX_SIGNER_REQUEST_FAILED", message });
      throw new Error(message, { cause: error });
    }
  }

  /**
   * Separates the failures that prove nothing was broadcast from the ones that leave a transaction possibly in
   * flight, so a caller can tell a safe retry from one that could pay twice.
   */
  private toTxOutcomeError(error: AxiosError): Error | undefined {
    const outcome = this.getSignerOutcome(error.response?.data);

    if (outcome) {
      const txHash = this.getSignerTxHash(error.response?.data);
      return outcome === "not_included" ? new TxNotIncludedError(txHash) : new TxOutcomeUnknownError(txHash);
    }

    if (error.response) {
      return error.response.status === UNDECIDED_UPSTREAM_STATUS ? new TxOutcomeUnknownError() : undefined;
    }

    return UNDECIDED_TRANSPORT_CODES.has(error.code ?? "") ? new TxOutcomeUnknownError() : undefined;
  }

  private getSignerOutcome(payload: unknown): TxOutcome | undefined {
    const outcome = this.getSignerErrorData(payload)?.outcome;

    return outcome === "not_included" || outcome === "unknown" ? outcome : undefined;
  }

  private getSignerTxHash(payload: unknown): string | undefined {
    const txHash = this.getSignerErrorData(payload)?.txHash;

    return typeof txHash === "string" && txHash.length > 0 ? txHash : undefined;
  }

  private getSignerErrorData(payload: unknown): { outcome?: unknown; txHash?: unknown } | undefined {
    if (!payload || typeof payload !== "object" || !("data" in payload)) {
      return undefined;
    }

    const { data } = payload as { data?: unknown };

    return data && typeof data === "object" ? (data as { outcome?: unknown; txHash?: unknown }) : undefined;
  }

  private getErrorMessage(payload: unknown, fallback: string): string {
    if (payload && typeof payload === "object" && "message" in payload) {
      const message = (payload as { message?: unknown }).message;
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
    }

    return fallback;
  }
}
