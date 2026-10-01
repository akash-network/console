import type { ChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import type { LoggerService } from "@akashnetwork/logging";
import { X509Certificate } from "crypto";

export class ProviderService {
  readonly #chainSdk: ChainNodeWebSDK;
  readonly #logger?: LoggerService;

  constructor(chainSdk: ChainNodeWebSDK, logger?: LoggerService) {
    this.#chainSdk = chainSdk;
    this.#logger = logger;
  }

  async getCertificate(providerAddress: string, serialNumber: string): Promise<X509Certificate | null> {
    try {
      const response = await this.#chainSdk.akash.cert.v1.getCertificates({
        pagination: {
          limit: 1
        },
        filter: {
          owner: providerAddress,
          serial: BigInt(`0x${serialNumber}`).toString(10),
          state: "valid"
        }
      });
      const cert = response.certificates[0]?.certificate;
      if (!cert) return null;

      return new X509Certificate(cert.cert);
    } catch (error) {
      this.#logger?.error({
        event: "PROVIDER_CERTIFICATE_FETCH_ERROR",
        providerAddress,
        serialNumber,
        error
      });
      throw error;
    }
  }

  /** Resolves `null` when chain has no such provider and rejects when chain cannot be queried. */
  async getHostUri(providerAddress: string): Promise<string | null> {
    try {
      const response = await this.#chainSdk.akash.provider.v1beta4.getProvider({ owner: providerAddress });
      return response.provider?.hostUri || null;
    } catch (error) {
      if (error instanceof SDKError && error.code === SDKErrorCode.NotFound) return null;

      this.#logger?.error({
        event: "PROVIDER_HOST_FETCH_ERROR",
        providerAddress,
        error
      });
      throw error;
    }
  }

  isValidationServerError(rawBody: unknown): boolean {
    if (typeof rawBody !== "string") return false;
    const body = rawBody.trim();
    return body.startsWith("manifest cross-validation error:") || body.startsWith("hostname not allowed:") || body.includes("validation failed");
  }
}
