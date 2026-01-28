import type { EncodeObject, Registry } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate/build/stargateclient";
import axios from "axios";
import { inject, singleton } from "tsyringe";

import type { SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { LoggerService } from "@src/core";

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
  data: IndexedTx;
};

@singleton()
export class ExternalSignerHttpSdkService {
  constructor(
    private readonly billingConfigService: BillingConfigService,
    private readonly logger: LoggerService,
    @inject(TYPE_REGISTRY) private readonly registry: Registry
  ) {
    this.logger.setContext(ExternalSignerHttpSdkService.name);
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
          "Content-Type": "application/json"
        },
        timeout: 60_000
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = this.getErrorMessage(error.response?.data, error.message);
        this.logger.error({ event: "TX_SIGNER_REQUEST_FAILED", status: error.response?.status, message });
        throw new Error(message);
      }

      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error({ event: "TX_SIGNER_REQUEST_FAILED", message });
      throw new Error(message);
    }
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
