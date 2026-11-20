import type { MxRecord } from "node:dns";
import { Resolver } from "node:dns/promises";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

export interface DnsResolver {
  resolveMx(hostname: string): Promise<MxRecord[]>;
  resolve4(hostname: string): Promise<string[]>;
  resolve6(hostname: string): Promise<string[]>;
}

export const DNS_RESOLVER: InjectionToken<DnsResolver> = Symbol("DNS_RESOLVER");

/** Runs inside the trial activation request, so a slow nameserver costs at most one timeout per lookup round instead of the system resolver's retries. */
const DNS_TIMEOUT_MS = 1_000;

container.register(DNS_RESOLVER, {
  useFactory: instancePerContainerCachingFactory((): DnsResolver => new Resolver({ timeout: DNS_TIMEOUT_MS, tries: 1 }))
});
