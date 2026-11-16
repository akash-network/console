import type { HttpClient } from "@akashnetwork/http-sdk";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

import { LoggerService } from "@src/common/services/logger/logger.service";
import type { AlertConfig } from "@src/modules/alert/config";
import { CHAIN_API_HTTP_CLIENT_TOKEN } from "@src/modules/alert/providers/http-sdk.provider";

const ProviderResponseSchema = z.object({ provider: z.object({ host_uri: z.string() }) });

@Injectable()
export class ProviderHostService {
  constructor(
    @Inject(CHAIN_API_HTTP_CLIENT_TOKEN) private readonly chainApi: HttpClient,
    private readonly configService: ConfigService<AlertConfig>,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(ProviderHostService.name);
  }

  /** A failed lookup labels the provider by its address rather than holding its alert back. */
  async labelFor(provider: string): Promise<string> {
    try {
      return await this.#findHost(provider);
    } catch (error) {
      this.loggerService.warn({ event: "PROVIDER_HOST_LOOKUP_FAILED", provider, error });
      return provider;
    }
  }

  /** Races the abort because the chain client's retry backoff, which honors Retry-After, sleeps through it. */
  async #findHost(provider: string): Promise<string> {
    const signal = AbortSignal.timeout(this.configService.getOrThrow("alert.PROVIDER_HOST_LOOKUP_TIMEOUT_MS"));
    const { data } = await Promise.race([
      this.chainApi.get(`/akash/provider/v1beta4/providers/${encodeURIComponent(provider)}`, { signal }),
      rejectOnAbort(signal)
    ]);
    const { hostname } = new URL(ProviderResponseSchema.parse(data).provider.host_uri);

    if (!hostname) {
      throw new Error(`Provider ${provider} has a host_uri without a host`);
    }

    return hostname;
  }
}

function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
}
