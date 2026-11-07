import uniq from "lodash/uniq";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";

export const AKASH_ADDRESS_PATTERN = /\bakash1[02-9ac-hj-np-z]{38,58}\b/g;

const OWN_WALLET_LABEL = "your Console wallet";
const OTHER_ACCOUNT_LABEL = "another Akash account";

/** The host Console shows as a provider's name. */
export function providerNameOf(hostUri: string): string {
  try {
    return new URL(hostUri).hostname || hostUri;
  } catch {
    return hostUri;
  }
}

export function akashAddressesIn(text: string): string[] {
  return uniq(text.match(AKASH_ADDRESS_PATTERN) ?? []);
}

function withStringsMapped(value: unknown, map: (text: string) => string): unknown {
  if (typeof value === "string") return map(value);
  if (Array.isArray(value)) return value.map(item => withStringsMapped(item, map));
  if (typeof value !== "object" || value === null) return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [map(key), withStringsMapped(entry, map)]));
}

/** Names the akash1 addresses a tool read, so the model can tell who a provider or account is without an address to repeat. */
@singleton()
export class AssistantAddressNamesService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly providerRepository: ProviderRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AssistantAddressNamesService.name });
  }

  /** Names nothing when the lookup fails, since a tool result keeps each providerAddress beside its name. */
  async providerNamesOf(addresses: string[]): Promise<Map<string, string>> {
    try {
      return await this.#providerNamesOf(addresses);
    } catch (error) {
      this.#logger.warn({ event: "ASSISTANT_PROVIDER_NAMES_FAILED", error });
      return new Map();
    }
  }

  /** Replaces every akash1 address in a read's strings and keys, rather than in its JSON text, so a name holding a quote cannot break the JSON. */
  async withAddressesNamed(value: unknown): Promise<unknown> {
    const addresses = akashAddressesIn(JSON.stringify(value) ?? "");
    if (addresses.length === 0) return value;

    const [providerNames, ownWallet] = await Promise.all([
      this.#providerNamesOf(addresses),
      this.userWalletRepository.findOneUsedBy(this.authService.currentUser.id)
    ]);

    const nameOf = (address: string) => {
      if (address === ownWallet?.address) return OWN_WALLET_LABEL;

      const providerName = providerNames.get(address);
      return providerName ? `provider ${providerName}` : OTHER_ACCOUNT_LABEL;
    };

    return withStringsMapped(value, text => text.replace(AKASH_ADDRESS_PATTERN, nameOf));
  }

  async #providerNamesOf(addresses: string[]): Promise<Map<string, string>> {
    const uniqueAddresses = uniq(addresses);
    if (uniqueAddresses.length === 0) return new Map();

    const providers = await this.providerRepository.getProvidersByAddressesWithAttributes(uniqueAddresses);
    return new Map(providers.map(({ owner, hostUri }) => [owner, providerNameOf(hostUri)]));
  }
}
