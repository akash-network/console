import { Bip39, Random } from "@cosmjs/crypto";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SeedDecrypter } from "@src/lib/seed-decrypter/kms-seed-decrypter";
import { Wallet } from "@src/lib/wallet/wallet";
import type { LoggerService } from "@src/providers/logging.provider";
import type { AppConfigService } from "@src/services/app-config/app-config.service";
import { DerivationSeedService } from "./derivation-seed.service";

describe(DerivationSeedService.name, () => {
  describe("deriveWallet", () => {
    it("derives wallets from the readable seeds without decrypting anything", async () => {
      const [earlier, current] = [seedPhrase(), seedPhrase()];
      const { service, createSeedDecrypter } = setup({ readable: { v1: earlier, v2: current } });

      await expect(service.deriveWallet(4, "v1").getFirstAddress()).resolves.toBe(await new Wallet(earlier, 4).getFirstAddress());
      await expect(service.deriveWallet(4, "v2").getFirstAddress()).resolves.toBe(await new Wallet(current, 4).getFirstAddress());
      await expect(service.deriveWallet(0, "v2").getFirstAddress()).resolves.toBe(await new Wallet(current, 0).getFirstAddress());

      expect(createSeedDecrypter).not.toHaveBeenCalled();
    });

    it("derives wallets from a decrypted seed once the seeds are loaded", async () => {
      const added = seedPhrase();
      const { service, decrypter } = setup({ readable: { v2: seedPhrase() }, encrypted: { v3: added } });

      await service.load();

      await expect(service.deriveWallet(7, "v3").getFirstAddress()).resolves.toBe(await new Wallet(added, 7).getFirstAddress());
      expect(decrypter.decrypt).toHaveBeenCalledExactlyOnceWith(ciphertextOf(added));
    });

    it("accepts a decrypted seed with whitespace around it, as a secret pasted from a file has", async () => {
      const added = seedPhrase();
      const { service } = setup({ readable: { v2: seedPhrase() }, encrypted: { v3: added }, decryptsTo: plaintext => `  ${plaintext}\n` });

      await service.load();

      await expect(service.deriveWallet(7, "v3").getFirstAddress()).resolves.toBe(await new Wallet(added, 7).getFirstAddress());
    });

    it("answers that an encrypted seed is not ready while the seeds are not loaded", () => {
      const { service } = setup({ readable: { v2: seedPhrase() }, encrypted: { v3: seedPhrase() } });

      expect(() => service.deriveWallet(7, "v3")).toThrow(expect.objectContaining({ status: 503, message: "Derivation seed v3 is not decrypted yet" }));
    });

    it.each(["v1", "v9"])("answers that it holds no seed %s when none is configured", version => {
      const { service } = setup({ readable: { v2: seedPhrase() } });

      expect(() => service.deriveWallet(7, version)).toThrow(
        expect.objectContaining({ status: 501, message: `This signer holds no derivation seed ${version}` })
      );
    });
  });

  describe("load", () => {
    it("decrypts every encrypted seed once, however often it is asked to load", async () => {
      const { service, decrypter, createSeedDecrypter, logger } = setup({ encrypted: { v2: seedPhrase(), v3: seedPhrase() } });

      await Promise.all([service.load(), service.load()]);
      await service.load();

      expect(createSeedDecrypter).toHaveBeenCalledTimes(1);
      expect(decrypter.decrypt).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledExactlyOnceWith({ event: "DERIVATION_SEEDS_LOADED", versions: ["v2", "v3"] });
    });

    it("names the versions it holds without building a decrypter when no seed is encrypted", async () => {
      const { service, createSeedDecrypter, logger } = setup({ readable: { v2: seedPhrase(), v1: seedPhrase() } });

      await service.load();

      expect(createSeedDecrypter).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledExactlyOnceWith({ event: "DERIVATION_SEEDS_LOADED", versions: ["v1", "v2"] });
    });

    it("fails, naming the version, when the key service does not decrypt a seed", async () => {
      const refusal = new Error("PERMISSION_DENIED");
      const { service, decrypter, logger } = setup({ readable: { v2: seedPhrase() }, encrypted: { v3: seedPhrase() } });
      decrypter.decrypt.mockRejectedValue(refusal);

      await expect(service.load()).rejects.toMatchObject({ message: "Derivation seed v3 could not be decrypted", cause: refusal });

      expect(logger.error).toHaveBeenCalledWith({ event: "DERIVATION_SEED_UNAVAILABLE", version: "v3", error: refusal });
      expect(logger.info).not.toHaveBeenCalled();
    });

    it("fails when a seed decrypts to something that is not a seed phrase, without repeating any of it", async () => {
      const { service, logger } = setup({
        readable: { v2: seedPhrase() },
        encrypted: { v3: seedPhrase() },
        decryptsTo: plaintext => plaintext.split(" ").slice(1).concat("notaseedword").join(" ")
      });

      const failure = (await service.load().catch((error: unknown) => error)) as Error;

      expect(failure.message).toBe("Derivation seed v3 did not decrypt to a seed phrase");
      expect(failure.cause).toBeUndefined();
      expect(JSON.stringify(logger.error.mock.calls)).not.toContain("notaseedword");
      expect(logger.error).toHaveBeenCalledWith({
        event: "DERIVATION_SEED_UNAVAILABLE",
        version: "v3",
        error: "decrypted to something that is not a seed phrase"
      });
      expect(() => service.deriveWallet(1, "v3")).toThrow("Derivation seed v3 is not decrypted yet");
    });

    it("decrypts again on the next load after a failed one", async () => {
      const added = seedPhrase();
      const { service, decrypter } = setup({ readable: { v2: seedPhrase() }, encrypted: { v3: added } });
      decrypter.decrypt.mockRejectedValueOnce(new Error("UNAVAILABLE"));

      await expect(service.load()).rejects.toThrow("Derivation seed v3 could not be decrypted");
      await service.load();

      await expect(service.deriveWallet(2, "v3").getFirstAddress()).resolves.toBe(await new Wallet(added, 2).getFirstAddress());
    });
  });

  it("logs under its own name", () => {
    const { logger } = setup({ readable: { v2: seedPhrase() } });

    expect(logger.setContext).toHaveBeenCalledWith(DerivationSeedService.name);
  });

  function seedPhrase() {
    return Bip39.encode(Random.getBytes(32)).toString();
  }

  function ciphertextOf(plaintext: string) {
    return Buffer.from(`encrypted:${plaintext}`);
  }

  function setup(input: { readable?: { v1?: string; v2?: string }; encrypted?: Record<string, string>; decryptsTo?: (plaintext: string) => string }) {
    const encrypted = Object.fromEntries(
      Object.entries(input.encrypted ?? {}).map(([version, plaintext]) => [version, ciphertextOf(plaintext).toString("base64")])
    );
    const config = mock<AppConfigService>();
    config.get.mockImplementation(((key: string) => {
      const values: Record<string, unknown> = {
        DERIVATION_WALLET_MNEMONIC_V1: input.readable?.v1,
        DERIVATION_WALLET_MNEMONIC_V2: input.readable?.v2,
        DERIVATION_WALLET_SEEDS_ENCRYPTED: encrypted
      };

      return values[key];
    }) as AppConfigService["get"]);

    const decrypter = mock<SeedDecrypter>();
    decrypter.decrypt.mockImplementation(async ciphertext => {
      const plaintext = Buffer.from(ciphertext)
        .toString()
        .replace(/^encrypted:/, "");

      return input.decryptsTo ? input.decryptsTo(plaintext) : plaintext;
    });
    const createSeedDecrypter = vi.fn(() => decrypter);
    const logger = mock<LoggerService>();

    return { service: new DerivationSeedService(config, createSeedDecrypter, logger), decrypter, createSeedDecrypter, logger };
  }
});
