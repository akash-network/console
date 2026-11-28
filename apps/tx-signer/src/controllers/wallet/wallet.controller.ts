import type { JwtTokenPayload } from "@akashnetwork/chain-sdk";
import { inject, singleton } from "tsyringe";

import type {
  DerivedWalletAddressResponse,
  FundingWalletAddressesResponse,
  IssueProviderTokenRequestInput,
  IssueProviderTokenResponse
} from "@src/http-schemas/wallet.schema";
import { ProviderTokenService } from "@src/services/provider-token/provider-token.service";
import { type DerivedWalletVersion, TxManagerService } from "@src/services/tx-manager/tx-manager.service";

@singleton()
export class WalletController {
  constructor(
    @inject(TxManagerService) private readonly txManagerService: TxManagerService,
    @inject(ProviderTokenService) private readonly providerTokenService: ProviderTokenService
  ) {}

  async getFundingWalletAddresses(): Promise<FundingWalletAddressesResponse> {
    return { data: { addresses: await this.txManagerService.getFundingWalletAddresses() } };
  }

  async getDerivedWalletAddress(index: number, version: DerivedWalletVersion): Promise<DerivedWalletAddressResponse> {
    return { data: { address: await this.txManagerService.getDerivedWalletAddress(index, version) } };
  }

  async issueProviderToken({ data: { derivationIndex, leases, ttl } }: IssueProviderTokenRequestInput): Promise<IssueProviderTokenResponse> {
    const token = await this.providerTokenService.issue({ derivationIndex, leases: leases as JwtTokenPayload["leases"], ttl });

    return { data: { token } };
  }
}
