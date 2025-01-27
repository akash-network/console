import { SupportedChainNetworks } from "@akashnetwork/net";

import { httpRetry } from "../utils/retry";

export class ProviderService {
  constructor(
    private readonly getChainBaseUrl: (network: SupportedChainNetworks) => string,
    private readonly fetch: typeof global.fetch
  ) {}

  async hasCertificate(network: SupportedChainNetworks, providerAddress: string, serialNumber: string): Promise<boolean> {
    const queryParams = new URLSearchParams({
      "filter.state": "valid",
      "filter.owner": providerAddress,
      "filter.serial": serialNumber,
      "pagination.limit": "1"
    });

    const response = await httpRetry(() => this.fetch(`${this.getChainBaseUrl(network)}/akash/cert/v1beta3/certificates/list?${queryParams}`), {
      retryIf: response => response.status > 500
    });

    if (response.status >= 200 && response.status < 300) {
      const body = (await response.json()) as KnownCertificatesResponseBody;
      return body.certificates.length === 1;
    }

    return false;
  }
}

interface KnownCertificatesResponseBody {
  certificates: unknown[];
}
