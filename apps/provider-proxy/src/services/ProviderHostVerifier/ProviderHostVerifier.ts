import type { LoggerService } from "@akashnetwork/logging";
import { LRUCache } from "lru-cache";

import type { ProviderService } from "../ProviderService/ProviderService";

const HOST_RECHECK_INTERVAL_MS = 30 * 60 * 1000;

export class ProviderHostVerifier {
  /** Entries outlive the recheck interval so the last host chain reported can stand in while chain cannot be queried. */
  readonly #registeredHosts = new LRUCache<string, RegisteredHost>({ max: 100_000 });
  readonly #inflightLookups: Record<string, Promise<string | null>> = {};
  readonly #now: () => number;
  readonly #providerService: ProviderService;
  readonly #instrumentation?: ProviderHostVerifierInstrumentation;

  constructor(now: () => number, providerService: ProviderService, instrumentation?: ProviderHostVerifierInstrumentation) {
    this.#now = now;
    this.#providerService = providerService;
    this.#instrumentation = instrumentation;
  }

  /** A provider never seen before is allowed while chain cannot be queried, so deployments stay manageable through a chain outage. */
  async canProxyTo(url: string, providerAddress: string): Promise<boolean> {
    const origin = new URL(url).origin;
    const knownHost = this.#registeredHosts.get(providerAddress);

    if (knownHost?.origin === origin && this.#now() - knownHost.checkedAt < HOST_RECHECK_INTERVAL_MS) return true;

    let registeredOrigin: string | null;
    try {
      registeredOrigin = await this.#lookUpRegisteredOrigin(providerAddress);
    } catch {
      if (!knownHost) {
        this.#instrumentation?.onUnverifiedHost?.(url, providerAddress);
        return true;
      }
      this.#registeredHosts.set(providerAddress, { origin: knownHost.origin, checkedAt: this.#now() });
      registeredOrigin = knownHost.origin;
    }

    if (registeredOrigin === origin) return true;

    this.#instrumentation?.onUnregisteredHost?.(url, providerAddress, registeredOrigin);
    return false;
  }

  async #lookUpRegisteredOrigin(providerAddress: string): Promise<string | null> {
    try {
      this.#inflightLookups[providerAddress] ??= this.#fetchRegisteredOrigin(providerAddress);
      return await this.#inflightLookups[providerAddress];
    } finally {
      delete this.#inflightLookups[providerAddress];
    }
  }

  async #fetchRegisteredOrigin(providerAddress: string): Promise<string | null> {
    const origin = toOrigin(await this.#providerService.getHostUri(providerAddress));
    this.#registeredHosts.set(providerAddress, { origin, checkedAt: this.#now() });
    return origin;
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

interface RegisteredHost {
  origin: string | null;
  checkedAt: number;
}

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
