import type { SupportedChainNetworks } from "@akashnetwork/net";
import { X509Certificate } from "crypto";

import { httpRetry } from "../utils/retry";

export class ProviderService {
  constructor(
    private readonly getChainBaseUrl: (network: SupportedChainNetworks) => string,
    private readonly fetch: typeof global.fetch
  ) {}

  async getCertificate(network: SupportedChainNetworks, providerAddress: string, serialNumber: string): Promise<X509Certificate | null> {
    const queryParams = new URLSearchParams({
      "filter.state": "valid",
      "filter.owner": providerAddress,
      "filter.serial": BigInt(`0x${serialNumber}`).toString(10),
      "pagination.limit": "1"
    });

    const baseUrl = this.getChainBaseUrl(network);
    if (!baseUrl) {
      throw new Error(`No API URL provided for network ${network}`);
    }

    const response = await httpRetry(() => this.fetch(`${baseUrl}/akash/cert/v1beta3/certificates/list?${queryParams}`), {
      retryIf: response => response.status > 500
    });

    if (response.status >= 200 && response.status < 300) {
      const body = (await response.json()) as KnownCertificatesResponseBody;
      return body.certificates.length === 1 ? new X509Certificate(atob(body.certificates[0].certificate.cert)) : null;
    }

    return null;
  }
}

interface KnownCertificatesResponseBody {
  certificates: Array<{
    certificate: {
      cert: string;
    };
  }>;
}
