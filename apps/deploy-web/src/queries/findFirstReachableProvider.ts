import type { ApiProviderList } from "@src/types/provider";

/** Capped rather than unbounded because every probe in a batch goes through the provider proxy. */
export const PROVIDER_PROBE_CONCURRENCY = 5;

/** The first candidate to answer `probe`, or null when none of them does. */
export async function findFirstReachableProvider(
  providers: ApiProviderList[],
  probe: (provider: ApiProviderList) => Promise<unknown>
): Promise<ApiProviderList | null> {
  for (let start = 0; start < providers.length; start += PROVIDER_PROBE_CONCURRENCY) {
    const batch = providers.slice(start, start + PROVIDER_PROBE_CONCURRENCY);
    try {
      return await Promise.any(
        batch.map(async provider => {
          await probe(provider);
          return provider;
        })
      );
    } catch {
      continue;
    }
  }
  return null;
}
