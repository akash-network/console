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

  /** Replaces every akash1 address in a text with the provider's name, the user's own wallet or a neutral label. */
  async withAddressesNamed(text: string): Promise<string> {
    const addresses = akashAddressesIn(text);
    if (addresses.length === 0) return text;

    const [providerNames, ownWallet] = await Promise.all([
      this.#providerNamesOf(addresses),
      this.userWalletRepository.findOneUsedBy(this.authService.currentUser.id)
    ]);

    return text.replace(AKASH_ADDRESS_PATTERN, address => {
      if (address === ownWallet?.address) return OWN_WALLET_LABEL;

      const providerName = providerNames.get(address);
      return providerName ? `provider ${providerName}` : OTHER_ACCOUNT_LABEL;
    });
  }

  async #providerNamesOf(addresses: string[]): Promise<Map<string, string>> {
    const uniqueAddresses = uniq(addresses);
    if (uniqueAddresses.length === 0) return new Map();

    const providers = await this.providerRepository.getProvidersByAddressesWithAttributes(uniqueAddresses);
    return new Map(providers.map(({ owner, hostUri }) => [owner, providerNameOf(hostUri)]));
  }
}
