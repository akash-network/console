import type { LoggerService } from "@akashnetwork/logging";
import { LRUCache } from "lru-cache";

import type { ProviderInventoryService } from "../ProviderInventoryService/ProviderInventoryService";
import type { ProviderService } from "../ProviderService/ProviderService";

const HOST_RECHECK_INTERVAL_MS = 30 * 60 * 1000;
/** Caps how often requests that the cached record does not allow can send the proxy back to chain. */
const MIN_HOST_RECHECK_INTERVAL_MS = 60 * 1000;

export class ProviderHostVerifier {
  /** Records outlive the recheck interval so the last host chain reported can stand in while chain cannot be queried. */
  readonly #hostRecords = new LRUCache<string, HostRecord>({ max: 100_000 });
  readonly #inflightRechecks: Record<string, Promise<HostRecord>> = {};
  readonly #now: () => number;
  readonly #providerService: ProviderService;
  readonly #providerInventory?: ProviderInventoryService;
  readonly #instrumentation?: ProviderHostVerifierInstrumentation;

  constructor(
    now: () => number,
    providerService: ProviderService,
    providerInventory?: ProviderInventoryService,
    instrumentation?: ProviderHostVerifierInstrumentation
  ) {
    this.#now = now;
    this.#providerService = providerService;
    this.#providerInventory = providerInventory;
    this.#instrumentation = instrumentation;
  }

  /** A provider never seen before is allowed while neither chain nor the provider inventory can be queried, so deployments stay manageable through a chain outage. */
  async canProxyTo(url: string, providerAddress: string): Promise<boolean> {
    const origin = new URL(url).origin;
    const cachedRecord = this.#hostRecords.get(providerAddress);
    const record = cachedRecord && !this.#isDueForRecheck(cachedRecord, origin) ? cachedRecord : await this.#recheck(providerAddress, cachedRecord);

    if (!record.verified) {
      this.#instrumentation?.onUnverifiedHost?.(url, providerAddress);
      return true;
    }

    if (record.origin === origin) return true;

    this.#instrumentation?.onUnregisteredHost?.(url, providerAddress, record.origin);
    return false;
  }

  /** `now` is a wall clock that can step backward, so a negative age has to mean due rather than fresh. */
  #isDueForRecheck(record: HostRecord, origin: string): boolean {
    const recheckIntervalMs = record.verified && record.origin === origin ? HOST_RECHECK_INTERVAL_MS : MIN_HOST_RECHECK_INTERVAL_MS;
    const ageMs = this.#now() - record.checkedAt;
    return ageMs < 0 || ageMs >= recheckIntervalMs;
  }

  async #recheck(providerAddress: string, previousRecord: HostRecord | undefined): Promise<HostRecord> {
    try {
      this.#inflightRechecks[providerAddress] ??= this.#lookUpHostRecord(providerAddress, previousRecord);
      return await this.#inflightRechecks[providerAddress];
    } finally {
      delete this.#inflightRechecks[providerAddress];
    }
  }

  async #lookUpHostRecord(providerAddress: string, previousRecord: HostRecord | undefined): Promise<HostRecord> {
    let record: HostRecord;
    try {
      record = { verified: true, source: "chain", origin: toOrigin(await this.#providerService.getHostUri(providerAddress)), checkedAt: this.#now() };
    } catch {
      record =
        previousRecord?.verified && previousRecord.source === "chain"
          ? this.#carryOver(previousRecord)
          : await this.#lookUpInventoryHostRecord(providerAddress, previousRecord);
    }

    this.#hostRecords.set(providerAddress, record);
    return record;
  }

  async #lookUpInventoryHostRecord(providerAddress: string, previousRecord: HostRecord | undefined): Promise<HostRecord> {
    if (!this.#providerInventory) return this.#carryOver(previousRecord);

    try {
      return { verified: true, source: "inventory", origin: toOrigin(await this.#providerInventory.getHostUri(providerAddress)), checkedAt: this.#now() };
    } catch {
      return this.#carryOver(previousRecord);
    }
  }

  #carryOver(previousRecord: HostRecord | undefined): HostRecord {
    return previousRecord?.verified ? { ...previousRecord, checkedAt: this.#now() } : { verified: false, checkedAt: this.#now() };
  }
}

function toOrigin(hostUri: string | null): string | null {
  if (!hostUri) return null;

  try {
    return new URL(hostUri).origin;
  } catch {
    return null;
  }
}

type HostRecord = { verified: true; source: "chain" | "inventory"; origin: string | null; checkedAt: number } | { verified: false; checkedAt: number };

export interface ProviderHostVerifierInstrumentation {
  onUnverifiedHost?(url: string, providerAddress: string): void;
  onUnregisteredHost?(url: string, providerAddress: string, registeredOrigin: string | null): void;
}

export const createProviderHostVerifierInstrumentation = (logger: LoggerService): ProviderHostVerifierInstrumentation => ({
  onUnverifiedHost(url, providerAddress) {
    logger.warn({ event: "PROVIDER_HOST_UNVERIFIED", url, providerAddress });
  },
  onUnregisteredHost(url, providerAddress, registeredOrigin) {
    logger.warn({ event: "PROVIDER_HOST_NOT_REGISTERED", url, providerAddress, registeredOrigin });
  }
});
