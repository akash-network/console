import { singleton } from "tsyringe";

import { LeaseRepository, type ProviderLeaseCount } from "@src/deployment/repositories/lease/lease.repository";
import { type ProviderSearchQuery, type ProviderSearchSort, WALLET_LEASE_SORTS } from "@src/provider/http-schemas/provider.schema";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import type { ProviderList } from "@src/types/provider";

export type ProviderLocation = Pick<ProviderList, "owner" | "name" | "hostUri" | "ipRegion" | "ipCountryCode" | "ipLat" | "ipLon">;

type WalletLeaseCounts = Map<string, ProviderLeaseCount>;

@singleton()
export class ProviderSearchService {
  constructor(
    private readonly providerService: ProviderService,
    private readonly leaseRepository: LeaseRepository
  ) {}

  async search(query: ProviderSearchQuery): Promise<{ providers: ProviderList[]; total: number }> {
    const [providers, walletLeaseCounts] = await Promise.all([this.providerService.getProviderList(false), this.#countWalletLeases(query)]);
    const matchesQuery = createQueryMatcher(query);
    const matches = providers.filter(matchesQuery).sort(compareBy(query.sort, walletLeaseCounts));

    return { providers: matches.slice(query.skip, query.skip + query.limit), total: matches.length };
  }

  async findOnlineLocations(): Promise<ProviderLocation[]> {
    const providers = await this.providerService.getProviderList(false);

    return providers
      .filter(provider => provider.isOnline)
      .map(({ owner, name, hostUri, ipRegion, ipCountryCode, ipLat, ipLon }) => ({ owner, name, hostUri, ipRegion, ipCountryCode, ipLat, ipLon }));
  }

  async #countWalletLeases({ sort, walletAddress }: Pick<ProviderSearchQuery, "sort" | "walletAddress">): Promise<WalletLeaseCounts> {
    if (!walletAddress || !WALLET_LEASE_SORTS.includes(sort)) {
      return new Map();
    }

    const counts = await this.leaseRepository.countLeasesPerProvider(walletAddress);

    return new Map(counts.map(count => [count.providerAddress, count]));
  }
}

function createQueryMatcher({ search, online, audited, addresses }: ProviderSearchQuery): (provider: ProviderList) => boolean {
  const term = search?.toLowerCase();
  const allowedAddresses = addresses && new Set(addresses);

  return provider =>
    (online === undefined || provider.isOnline === online) &&
    (audited === undefined || provider.isAudited === audited) &&
    (!allowedAddresses || allowedAddresses.has(provider.owner)) &&
    (!term || provider.hostUri.toLowerCase().includes(term) || provider.owner.includes(term));
}

function compareBy(sort: ProviderSearchSort, walletLeaseCounts: WalletLeaseCounts): (a: ProviderList, b: ProviderList) => number {
  const walletLeasesOf = (provider: ProviderList) => walletLeaseCounts.get(provider.owner)?.leaseCount ?? 0;
  const walletActiveLeasesOf = (provider: ProviderList) => walletLeaseCounts.get(provider.owner)?.activeLeaseCount ?? 0;

  switch (sort) {
    case "active-leases-asc":
      return (a, b) => activeLeasesOf(a) - activeLeasesOf(b);
    case "active-leases-desc":
      return (a, b) => activeLeasesOf(b) - activeLeasesOf(a);
    case "wallet-leases-desc":
      return (a, b) => walletLeasesOf(b) - walletLeasesOf(a);
    case "wallet-active-leases-desc":
      return (a, b) => walletActiveLeasesOf(b) - walletActiveLeasesOf(a);
    case "gpus-desc":
      return (a, b) => gpuCountOf(b) - gpuCountOf(a);
  }
}

function activeLeasesOf(provider: ProviderList): number {
  return provider.leaseCount ?? 0;
}

function gpuCountOf({ stats: { gpu } }: ProviderList): number {
  return gpu.available + gpu.pending + gpu.active;
}
