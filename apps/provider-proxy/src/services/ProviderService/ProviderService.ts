import type { createChainNodeSDK, QueryInput } from "@akashnetwork/chain-sdk";
import type { QueryCertificatesRequest, QueryCertificatesResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { LoggerService } from "@akashnetwork/logging";
import { ExponentialBackoff, handleWhen, retry } from "cockatiel";
import { X509Certificate } from "crypto";

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
    const queryParams: QueryInput<QueryCertificatesRequest> = {
      filter: {
        state: "valid",
        owner: providerAddress,
        serial: BigInt(`0x${serialNumber}`).toString(10)
      },
      pagination: {
        limit: 1
      }
    };

    try {
      const response = await this.fetchCertificate(queryParams);
      if (response.certificates.length === 1) {
        const cert = response.certificates[0]?.certificate?.cert;
        return cert ? new X509Certificate(cert) : null;
      }

      return null;
    } catch (error: any) {
      this.logger?.error({ event: "CERTIFICATE_FETCH_ERROR", providerAddress, serialNumber, error });
      return null;
    }
  }

  private async fetchCertificate(getCertificatesParams: QueryInput<QueryCertificatesRequest>): Promise<QueryCertificatesResponse> {
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
