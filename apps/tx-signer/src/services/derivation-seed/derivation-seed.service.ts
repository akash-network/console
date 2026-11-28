import { EnglishMnemonic } from "@cosmjs/crypto";
import createError from "http-errors";
import { container, inject, type InjectionToken, singleton } from "tsyringe";

import { memoizeAsync } from "@src/caching/helpers/helpers";
import { KmsSeedDecrypter, type SeedDecrypter } from "@src/lib/seed-decrypter/kms-seed-decrypter";
import { Wallet } from "@src/lib/wallet/wallet";
import { KMS_CLIENT } from "@src/providers/kms-client.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { AppConfigService } from "@src/services/app-config/app-config.service";

export type SeedDecrypterFactory = () => SeedDecrypter;

/** A factory, so a signer with no encrypted seed never builds a key service client it has no identity for. */
export const SEED_DECRYPTER_FACTORY: InjectionToken<SeedDecrypterFactory> = Symbol("SEED_DECRYPTER_FACTORY");

container.register(SEED_DECRYPTER_FACTORY, {
  useFactory: c => () => {
    const keyName = c.resolve(AppConfigService).get("DERIVATION_SEED_KMS_KEY");

    if (!keyName) throw new Error("DERIVATION_SEED_KMS_KEY is required to decrypt a derivation seed");

    return new KmsSeedDecrypter(c.resolve(KMS_CLIENT), keyName);
  }
});

/** Holds the seed phrases user wallets are derived from, each under the version a wallet records, in memory only. */
@singleton()
export class DerivationSeedService {
  readonly #seedPhrasesByVersion = new Map<string, string>();

  readonly #encryptedSeedsByVersion: Record<string, string>;

  /** Start-up waits on this, so no request meets a seed that is still being decrypted. */
  readonly load = memoizeAsync(async (): Promise<void> => {
    const encryptedSeeds = Object.entries(this.#encryptedSeedsByVersion);

    if (encryptedSeeds.length > 0) {
      const decrypter = this.createSeedDecrypter();
      await Promise.all(encryptedSeeds.map(([version, ciphertext]) => this.#decrypt(decrypter, version, ciphertext)));
    }

    this.logger.info({ event: "DERIVATION_SEEDS_LOADED", versions: [...this.#seedPhrasesByVersion.keys()].sort() });
  });

  constructor(
    @inject(AppConfigService) config: AppConfigService,
    @inject(SEED_DECRYPTER_FACTORY) private readonly createSeedDecrypter: SeedDecrypterFactory,
    @inject(LoggerService) private readonly logger: LoggerService
  ) {
    this.logger.setContext(DerivationSeedService.name);
    this.#encryptedSeedsByVersion = config.get("DERIVATION_WALLET_SEEDS_ENCRYPTED");

    for (const [version, seedPhrase] of Object.entries({ v1: config.get("DERIVATION_WALLET_MNEMONIC_V1"), v2: config.get("DERIVATION_WALLET_MNEMONIC_V2") })) {
      if (seedPhrase) this.#seedPhrasesByVersion.set(version, seedPhrase);
    }
  }

  deriveWallet(index: number, version: string): Wallet {
    return new Wallet(this.#getSeedPhrase(version), index);
  }

  #getSeedPhrase(version: string): string {
    const seedPhrase = this.#seedPhrasesByVersion.get(version);

    if (seedPhrase) return seedPhrase;

    if (version in this.#encryptedSeedsByVersion) throw createError(503, `Derivation seed ${version} is not decrypted yet`);

    throw createError(501, `This signer holds no derivation seed ${version}`);
  }

  async #decrypt(decrypter: SeedDecrypter, version: string, ciphertext: string): Promise<void> {
    const seedPhrase = await decrypter.decrypt(Buffer.from(ciphertext, "base64")).catch(error => {
      this.logger.error({ event: "DERIVATION_SEED_UNAVAILABLE", version, error });
      throw new Error(`Derivation seed ${version} could not be decrypted`, { cause: error });
    });

    this.#seedPhrasesByVersion.set(version, this.#toValidSeedPhrase(version, seedPhrase));
  }

  /** The parser names the word it stumbles on, so its error is dropped instead of being logged or passed on. */
  #toValidSeedPhrase(version: string, decrypted: string): string {
    const seedPhrase = decrypted.trim();

    try {
      new EnglishMnemonic(seedPhrase);
    } catch {
      this.logger.error({ event: "DERIVATION_SEED_UNAVAILABLE", version, error: "decrypted to something that is not a seed phrase" });
      throw new Error(`Derivation seed ${version} did not decrypt to a seed phrase`);
    }

    return seedPhrase;
  }
}
