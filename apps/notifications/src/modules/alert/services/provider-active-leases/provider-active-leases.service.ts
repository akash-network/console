import type { HttpClient, RestAkashLeaseListResponse, RpcLease } from "@akashnetwork/http-sdk";
import { extractData, isLeaseLive } from "@akashnetwork/http-sdk";
import { Inject, Injectable } from "@nestjs/common";

import { CHAIN_API_HTTP_CLIENT_TOKEN } from "@src/modules/alert/providers/http-sdk.provider";
import type { ProviderLeaseId } from "@src/modules/alert/types/provider-lease.type";

@Injectable()
export class ProviderActiveLeasesService {
  constructor(@Inject(CHAIN_API_HTTP_CLIENT_TOKEN) private readonly chainApi: HttpClient) {}

  async list(provider: string, pageSize = 100): Promise<ProviderLeaseId[]> {
    const leases: RpcLease[] = [];
    let key: string | undefined;

    do {
      const page = extractData(
        await this.chainApi.get<RestAkashLeaseListResponse>("/akash/market/v1beta5/leases/list", {
          params: {
            "filters.provider": provider,
            "pagination.limit": pageSize,
            "pagination.key": key
          },
          timeout: 30000
        })
      );
      leases.push(...page.leases);

      if (page.leases.length === 0) break;
      key = page.pagination.next_key ?? undefined;
    } while (key);

    return leases.filter(({ lease }) => isLeaseLive(lease)).map(({ lease }) => ({ ...lease.id }));
  }
}
