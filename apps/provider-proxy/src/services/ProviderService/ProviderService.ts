import type { createChainNodeSDK } from "@akashnetwork/chain-sdk";
import type { QueryCertificatesRequest, QueryCertificatesResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { LoggerService } from "@akashnetwork/logging";
import { ExponentialBackoff, handleWhen, retry } from "cockatiel";
import type { DeepPartial } from "cosmjs-types/helpers";
import { X509Certificate } from "crypto";
import Long from "long";

type ChainNodeSDK = ReturnType<typeof createChainNodeSDK>;

const RETRIABLE_ERROR_CODES = [
  13, // internal
  14 // unavailable
];

interface ErrorWithCode {
  code?: number;
}

function hasErrorCode(error: unknown): error is ErrorWithCode {
  return typeof error === "object" && error !== null && "code" in error;
}

export class ProviderService {
  private retryPolicy = retry(
    handleWhen(error => {
      return hasErrorCode(error) && RETRIABLE_ERROR_CODES.includes(error.code!);
    }),
    {
      maxAttempts: 3,
      backoff: new ExponentialBackoff()
    }
  );

  constructor(
    private readonly chainSdkClient: ChainNodeSDK,
    private readonly logger?: LoggerService
  ) {}

  async getCertificate(providerAddress: string, serialNumber: string): Promise<X509Certificate | null> {
    const queryParams: DeepPartial<QueryCertificatesRequest> = {
      filter: {
        state: "valid",
        owner: providerAddress,
        serial: BigInt(`0x${serialNumber}`).toString(10)
      },
      pagination: {
        limit: Long.fromNumber(1)
      }
    };

    try {
      const response = await this.fetchCertificate(queryParams);
      return response.certificates.length === 1 ? new X509Certificate(response.certificates[0].certificate!.cert) : null;
    } catch (error: any) {
      const { code } = error;
      this.logger?.error({ event: "CERTIFICATE_FETCH_ERROR", providerAddress, serialNumber, code });
      return null;
    }
  }

  private async fetchCertificate(getCertificatesParams: DeepPartial<QueryCertificatesRequest>): Promise<QueryCertificatesResponse> {
    return this.retryPolicy.execute(async () => {
      return await this.chainSdkClient.akash.cert.v1.getCertificates(getCertificatesParams as QueryCertificatesRequest);
    });
  }

  isValidationServerError(rawBody: unknown): boolean {
    if (typeof rawBody !== "string") return false;
    const body = rawBody.trim();
    return body.startsWith("manifest cross-validation error:") || body.startsWith("hostname not allowed:") || body.includes("validation failed");
  }
}
