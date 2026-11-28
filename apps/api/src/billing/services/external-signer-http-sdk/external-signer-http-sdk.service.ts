import type { JwtTokenPayload } from "@akashnetwork/chain-sdk";
import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate";
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import axios from "axios";
import { Err, Ok, type Result } from "ts-results";
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

export type SignAndBroadcastFundingOptions = {
  granteeDerivationIndex: number;
};

/** A derived wallet as the signer knows it: the index it sits at and the seed it was derived from. */
export type DerivedWalletRef = { derivationIndex: number; seedVersion: string };

type SignAndBroadcastFundingRequest = {
  data: {
    messages: SignAndBroadcastRequestMessage[];
    granteeDerivationIndex?: number;
    granteeSeedVersion?: string;
  };
};

type SignAndBroadcastDerivedRequest = {
  data: {
    derivationIndex: number;
    seedVersion: string;
    messages: SignAndBroadcastRequestMessage[];
    options?: SignAndBroadcastOptions;
  };
};

type SignAndBroadcastResponse = {
  data: Pick<IndexedTx, "code" | "hash" | "rawLog">;
};

export type ProviderTokenRequest = DerivedWalletRef & {
  leases: JwtTokenPayload["leases"];
  ttl: number;
};

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;

/** 502 and 503 are excluded on purpose: the signer maps an unreachable chain node onto those, and reading them as undecided would hold funding claims over every RPC blip. */
const UNDECIDED_UPSTREAM_STATUS = 504;

/** Transport failures that can strike a request the signer already received, unlike a refused connection or unresolved host. */
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

  async signAndBroadcastWithFundingWallet(messages: readonly EncodeObject[], grantee?: DerivedWalletRef) {
    const response = await this.post<SignAndBroadcastResponse>("/v1/tx/funding", {
      data: {
        messages: this.encodeMessages(messages),
        granteeDerivationIndex: grantee?.derivationIndex,
        granteeSeedVersion: grantee?.seedVersion
      }
    } satisfies SignAndBroadcastFundingRequest);
    return response.data;
  }

  async signAndBroadcastWithDerivedWallet(
    { derivationIndex, seedVersion }: DerivedWalletRef,
    messages: readonly EncodeObject[],
    options?: SignAndBroadcastOptions
  ) {
    const response = await this.post<SignAndBroadcastResponse>("/v1/tx/derived", {
      data: {
        derivationIndex,
        seedVersion,
        messages: this.encodeMessages(messages),
        options
      }
    } satisfies SignAndBroadcastDerivedRequest);
    return response.data;
  }

  async getFundingWalletAddresses(): Promise<string[]> {
    const response = await this.callWalletRoute<{ data: { addresses: string[] } }>({ method: "get", url: "/v1/wallets/funding" });

    return response.data.data.addresses;
  }

  async getDerivedWalletAddress({ derivationIndex, seedVersion }: DerivedWalletRef): Promise<string> {
    const response = await this.callWalletRoute<{ data: { address: string } }>({
      method: "get",
      url: `/v1/wallets/derived/${derivationIndex}`,
      params: { version: seedVersion }
    });

    return response.data.data.address;
  }

  /** A token the signer refuses as malformed is the caller's to correct, so its reasons come back instead of being thrown. */
  async issueProviderToken(request: ProviderTokenRequest): Promise<Result<string, string[]>> {
    const response = await this.callWalletRoute<{ data: { token: string } }>({
      method: "post",
      url: "/v1/wallets/provider-tokens",
      data: { data: request },
      validateStatus: status => status === HTTP_OK || status === HTTP_BAD_REQUEST
    });

    if (response.status === HTTP_BAD_REQUEST) return Err([this.getErrorMessage(response.data, "The signer refused the provider token asked for")]);

    return Ok(response.data.data.token);
  }

  private async callWalletRoute<T>(request: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    try {
      return await axios.request<T>({
        ...request,
        baseURL: this.billingConfigService.get("TX_SIGNER_BASE_URL"),
        headers: { "Content-Type": "application/json", "x-api-key": this.billingConfigService.get("TX_SIGNER_API_KEY") },
        timeout: this.billingConfigService.get("TX_SIGNER_WALLET_REQUEST_TIMEOUT_MS")
      });
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      const message = axios.isAxiosError(error) ? this.getErrorMessage(error.response?.data, error.message) : "Unknown error";
      this.logger.error({ event: "TX_SIGNER_WALLET_REQUEST_FAILED", path: request.url, status, message });
      throw new Error(`The signer did not answer ${request.url}: ${message}`, { cause: error });
    }
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

  /** Separates the failures that prove nothing was broadcast from the ones that leave a tx possibly in flight. */
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
