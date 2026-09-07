import type { SDLInput } from "@akashnetwork/chain-sdk";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { MAX_SDL_REFERENCE_NAME_LENGTH, SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import type { SdlSecretsUnsealerService } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import type { SecretCipherService } from "@src/secret/services/secret-cipher/secret-cipher.service";
import { SdlSecretsService } from "./sdl-secrets.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const SEAL = "sealed.secrets.token.for.tests";
const RAW_SDL = "version: '2.0'";
const MAX_COUNT = 100;
const MAX_NAME_BYTES = MAX_SDL_REFERENCE_NAME_LENGTH;
const MAX_VALUE_BYTES = 16 * 1024;

function sdlWith(services: Record<string, string[]>): SDLInput {
  return { services: Object.fromEntries(Object.entries(services).map(([name, env]) => [name, { env }])) } as unknown as SDLInput;
}

describe(SdlSecretsService.name, () => {
  describe("receive", () => {
    it("returns the value a reference names", async () => {
      const { service } = setup({ supplied: { TOKEN: "resolved" } });

      const result = await service.receive({ sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL });

      expect(result.ok).toBe(true);
      expect(receivedOf(result)).toEqual({ TOKEN: "resolved" });
    });

    it("accepts one value several services reference", async () => {
      const { service } = setup({ supplied: { TOKEN: "shared" } });

      const result = await service.receive({
        sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"], worker: ["TOKEN=ac-secret://TOKEN"], cron: ["TOKEN=ac-secret://TOKEN"] }),
        rawSdl: RAW_SDL,
        sealedSecrets: SEAL
      });

      expect(receivedOf(result)).toEqual({ TOKEN: "shared" });
    });

    it("accepts names referenced from different services", async () => {
      const { service } = setup({ supplied: { TOKEN: "one", DATABASE_URL: "two" } });

      const result = await service.receive({
        sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"], db: ["DATABASE_URL=ac-secret://DATABASE_URL"] }),
        rawSdl: RAW_SDL,
        sealedSecrets: SEAL
      });

      expect(receivedOf(result)).toEqual({ TOKEN: "one", DATABASE_URL: "two" });
    });

    it("accepts a document whose other service references nothing", async () => {
      const { service } = setup({ supplied: { TOKEN: "resolved" } });

      const result = await service.receive({
        sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"], sidecar: ["LOG_LEVEL=debug"] }),
        rawSdl: RAW_SDL,
        sealedSecrets: SEAL
      });

      expect(receivedOf(result)).toEqual({ TOKEN: "resolved" });
    });

    it("names a reference it holds no value for", async () => {
      const { service } = setup({ supplied: { OTHER: "resolved" } });

      const result = await service.receive({
        sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN", "OTHER=ac-secret://OTHER"] }),
        rawSdl: RAW_SDL,
        sealedSecrets: SEAL
      });

      expect(result.ok).toBe(false);
      expect(errorsOf(result)[0].message).toContain('no value supplied for SDL Reference "ac-secret://TOKEN" in service "web"');
    });

    it("names a supplied value no service references", async () => {
      const { service } = setup({ supplied: { TOKEN: "resolved", TYPOED: "orphan" } });

      const result = await service.receive({ sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL });

      expect(result.ok).toBe(false);
      expect(errorsOf(result)[0].message).toBe('a value was supplied for "TYPOED" but no service\'s SDL references it');
    });

    it("reports a mistake on each side of the same request", async () => {
      const { service } = setup({ supplied: { TYPOED: "orphan" } });

      const result = await service.receive({ sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL });

      expect(errorsOf(result).map(error => error.message)).toEqual([
        'no value supplied for SDL Reference "ac-secret://TOKEN" in service "web"',
        'a value was supplied for "TYPOED" but no service\'s SDL references it'
      ]);
    });

    it("counts a name referenced by one service and missing for another as referenced", async () => {
      const { service } = setup({ supplied: { TOKEN: "resolved" } });

      const result = await service.receive({
        sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"], worker: ["LOG_LEVEL=debug"] }),
        rawSdl: RAW_SDL,
        sealedSecrets: SEAL
      });

      expect(result.ok).toBe(true);
    });

    it("carries an unreferenced name in the error params as well as its message", async () => {
      const name = `A${"b".repeat(MAX_NAME_BYTES - 1)}`;
      const { service } = setup({ supplied: { [name]: "orphan" } });

      const result = await service.receive({ sdl: sdlWith({ web: ["LOG_LEVEL=debug"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL });

      expect(errorsOf(result)[0].message).toContain(name);
      expect(errorsOf(result)[0].params).toEqual({ name });
    });

    it("says nothing about a supplied value in the mistake it reports", async () => {
      const value = faker.string.alphanumeric(32);
      const { service } = setup({ supplied: { TYPOED: value } });

      const result = await service.receive({ sdl: sdlWith({ web: ["LOG_LEVEL=debug"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL });

      expect(JSON.stringify(errorsOf(result))).not.toContain(value);
    });

    it("accepts a name spelling an Object.prototype member supplied for it", async () => {
      const { service } = setup({ supplied: JSON.parse('{"constructor":"resolved"}') as SdlSecrets });

      const result = await service.receive({ sdl: sdlWith({ web: ["C=ac-secret://constructor"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL });

      expect(result.ok).toBe(true);
    });

    it("refuses a reference whose name spells an Object.prototype member nothing was supplied for", async () => {
      const { service } = setup({ supplied: {} });

      const result = await service.receive({ sdl: sdlWith({ web: ["C=ac-secret://constructor"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL });

      expect(result.ok).toBe(false);
    });

    it("accepts a create that references nothing and supplies nothing without opening a seal", async () => {
      const { service, unsealerService } = setup();

      const result = await service.receive({ sdl: sdlWith({ web: ["LOG_LEVEL=debug"] }), rawSdl: RAW_SDL });

      expect(receivedOf(result)).toEqual({});
      expect(unsealerService.open).not.toHaveBeenCalled();
    });

    it("names every reference of a create that supplies no seal at all", async () => {
      const { service } = setup();

      const result = await service.receive({ sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"], db: ["URL=ac-secret://URL"] }), rawSdl: RAW_SDL });

      expect(errorsOf(result).map(error => error.message)).toEqual([
        'no value supplied for SDL Reference "ac-secret://TOKEN" in service "web"',
        'no value supplied for SDL Reference "ac-secret://URL" in service "db"'
      ]);
    });

    it("ignores a reference of a kind a sealed payload does not answer", async () => {
      const { service, unsealerService } = setup();

      const result = await service.receive({ sdl: sdlWith({ web: ["MODE=ac-probe://MODE"] }), rawSdl: RAW_SDL });

      expect(result.ok).toBe(true);
      expect(unsealerService.open).not.toHaveBeenCalled();
    });

    it("binds the seal to the sdl exactly as it arrived", async () => {
      const { service, unsealerService } = setup({ supplied: {} });
      const rawSdl = "version: '2.0'\nservices:\n  web:\n    image: nginx\n";

      await service.receive({ sdl: sdlWith({ web: ["LOG_LEVEL=debug"] }), rawSdl, sealedSecrets: SEAL });

      expect(unsealerService.open).toHaveBeenCalledWith({ seal: SEAL, sdl: rawSdl });
    });

    it("refuses more secrets than a deployment may carry", async () => {
      const supplied = Object.fromEntries(Array.from({ length: MAX_COUNT + 1 }, (_, index) => [`SECRET_${index}`, "value"]));
      const { service } = setup({ supplied });

      await expect(service.receive({ sdl: sdlWith({ web: ["LOG_LEVEL=debug"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL })).rejects.toMatchObject({
        status: 400,
        message: `At most ${MAX_COUNT} secrets may be supplied for one deployment`
      });
    });

    it("accepts exactly as many secrets as a deployment may carry", async () => {
      const names = Array.from({ length: MAX_COUNT }, (_, index) => `SECRET_${index}`);
      const { service } = setup({ supplied: Object.fromEntries(names.map(name => [name, "value"])) });

      const result = await service.receive({
        sdl: sdlWith({ web: names.map(name => `${name}=ac-secret://${name}`) }),
        rawSdl: RAW_SDL,
        sealedSecrets: SEAL
      });

      expect(result.ok).toBe(true);
    });

    it("refuses a value above the size a secret may be", async () => {
      const { service } = setup({ supplied: { TOKEN: "x".repeat(MAX_VALUE_BYTES + 1) } });

      await expect(service.receive({ sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL })).rejects.toMatchObject({
        status: 400,
        message: `Secret "TOKEN" exceeds the maximum value size of ${MAX_VALUE_BYTES} bytes once JSON-encoded`
      });
    });

    it("accepts a value of exactly the size a secret may be", async () => {
      const { service } = setup({ supplied: { TOKEN: "x".repeat(MAX_VALUE_BYTES) } });

      const result = await service.receive({ sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL });

      expect(result.ok).toBe(true);
    });

    it("measures a value in bytes rather than in characters", async () => {
      const { service } = setup({ supplied: { TOKEN: "🔐".repeat(MAX_VALUE_BYTES / 4 + 1) } });

      await expect(service.receive({ sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL })).rejects.toMatchObject({
        status: 400
      });
    });

    it("measures a value as the seal will carry it, so an escaped character costs what it costs", async () => {
      const quoted = '"'.repeat(MAX_VALUE_BYTES / 2);

      await expect(
        setup({ supplied: { TOKEN: quoted } }).service.receive({ sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL })
      ).resolves.toMatchObject({ ok: true });

      await expect(
        setup({ supplied: { TOKEN: `${quoted}"` } }).service.receive({
          sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"] }),
          rawSdl: RAW_SDL,
          sealedSecrets: SEAL
        })
      ).rejects.toMatchObject({ status: 400, message: `Secret "TOKEN" exceeds the maximum value size of ${MAX_VALUE_BYTES} bytes once JSON-encoded` });
    });

    it("refuses a supplied name longer than any sdl could reference", async () => {
      const name = "N".repeat(MAX_NAME_BYTES + 1);
      const { service } = setup({ supplied: { [name]: "value" } });

      await expect(service.receive({ sdl: sdlWith({ web: ["LOG_LEVEL=debug"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL })).rejects.toMatchObject({
        status: 400,
        message: `Secret name "${name}" exceeds the maximum of ${MAX_NAME_BYTES} bytes`
      });
    });

    it("accepts a supplied name of exactly the length an sdl could reference", async () => {
      const name = `A${"b".repeat(MAX_NAME_BYTES - 1)}`;
      const { service } = setup({ supplied: { [name]: "value" } });

      const result = await service.receive({ sdl: sdlWith({ web: [`T=ac-secret://${name}`] }), rawSdl: RAW_SDL, sealedSecrets: SEAL });

      expect(result.ok).toBe(true);
    });

    it("measures a supplied name the way the seal carries it too", async () => {
      const { service } = setup({ supplied: { ['"'.repeat(MAX_NAME_BYTES / 2 + 1)]: "value" } });

      await expect(service.receive({ sdl: sdlWith({ web: ["LOG_LEVEL=debug"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL })).rejects.toMatchObject({
        status: 400
      });
    });

    it("bounds an oversized name it echoes into the refusal", async () => {
      const { service } = setup({ supplied: { ["N".repeat(500)]: "value" } });

      await expect(service.receive({ sdl: sdlWith({ web: ["LOG_LEVEL=debug"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL })).rejects.toMatchObject({
        message: `Secret name "${"N".repeat(120)}" exceeds the maximum of ${MAX_NAME_BYTES} bytes`
      });
    });

    it("refuses on the name before measuring the value", async () => {
      const name = "N".repeat(MAX_NAME_BYTES + 1);
      const { service } = setup({ supplied: { [name]: "d".repeat(MAX_VALUE_BYTES + 1) } });

      await expect(service.receive({ sdl: sdlWith({ web: ["LOG_LEVEL=debug"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL })).rejects.toMatchObject({
        message: `Secret name "${name}" exceeds the maximum of ${MAX_NAME_BYTES} bytes`
      });
    });

    it("says nothing about an oversized value in the refusal it returns", async () => {
      const value = `${faker.string.alphanumeric(32)}${"x".repeat(MAX_VALUE_BYTES)}`;
      const { service } = setup({ supplied: { TOKEN: value } });

      await expect(service.receive({ sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL })).rejects.toSatisfy(
        (error: Error) => !error.message.includes(value.slice(0, 32))
      );
    });

    it("refuses on count before measuring any value", async () => {
      const supplied = Object.fromEntries(Array.from({ length: MAX_COUNT + 1 }, (_, index) => [`SECRET_${index}`, "x".repeat(MAX_VALUE_BYTES + 1)]));
      const { service } = setup({ supplied });

      await expect(service.receive({ sdl: sdlWith({ web: ["LOG_LEVEL=debug"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL })).rejects.toMatchObject({
        message: `At most ${MAX_COUNT} secrets may be supplied for one deployment`
      });
    });

    it("logs a name once however many services and entries reference it", async () => {
      const { service, logger } = setup({ supplied: { TOKEN: "shared" } });

      await service.receive({
        sdl: sdlWith({ web: ["A=ac-secret://TOKEN", "B=ac-secret://TOKEN"], worker: ["C=ac-secret://TOKEN"] }),
        rawSdl: RAW_SDL,
        sealedSecrets: SEAL
      });

      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ referencedNames: ["TOKEN"], serviceCount: 2 }));
    });

    it("logs the names an sdl references and only the count of what was supplied", async () => {
      const value = faker.string.alphanumeric(32);
      const { service, logger } = setup({ supplied: { TOKEN: value } });

      await service.receive({ sdl: sdlWith({ web: ["TOKEN=ac-secret://TOKEN"] }), rawSdl: RAW_SDL, sealedSecrets: SEAL });

      expect(logger.info).toHaveBeenCalledWith({ event: "SDL_SECRETS_RECEIVED", suppliedCount: 1, referencedNames: ["TOKEN"], serviceCount: 1 });
    });
  });

  describe("sealForStorage", () => {
    it("seals the whole set as one token bound to its owner and its deployment", async () => {
      const { service, secretCipherService } = setup();
      const secrets = { TOKEN: "one", DATABASE_URL: "two" };

      await service.sealForStorage({ userId: "user-1", dseq: "1420000", secrets });

      expect(secretCipherService.encrypt).toHaveBeenCalledWith("user-1", JSON.stringify(secrets), { sub: "user-1", dseq: "1420000" });
    });

    it("returns the token the cipher produced", async () => {
      const { service } = setup();

      await expect(service.sealForStorage({ userId: "user-1", dseq: "1420000", secrets: { TOKEN: "one" } })).resolves.toBe("encrypted");
    });

    it("spends one encryption however many secrets the deployment has", async () => {
      const { service, secretCipherService } = setup();
      const secrets = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`SECRET_${index}`, "value"]));

      await service.sealForStorage({ userId: "user-1", dseq: "1420000", secrets });

      expect(secretCipherService.encrypt).toHaveBeenCalledOnce();
    });

    it("writes no token for a deployment that supplied nothing", async () => {
      const { service, secretCipherService } = setup();

      await expect(service.sealForStorage({ userId: "user-1", dseq: "1420000", secrets: {} })).resolves.toBeNull();
      expect(secretCipherService.encrypt).not.toHaveBeenCalled();
    });

    it("says nothing about a value in what it logs", async () => {
      const value = faker.string.alphanumeric(32);
      const { service, logger } = setup();

      await service.sealForStorage({ userId: "user-1", dseq: "1420000", secrets: { TOKEN: value } });

      expect(logger.info).toHaveBeenCalledWith({ event: "SDL_SECRETS_SEALED", userId: "user-1", dseq: "1420000", secretCount: 1 });
    });
  });

  describe("openStored", () => {
    it("opens the token under the binding the seal was written with", async () => {
      const { service, secretCipherService } = setup({ stored: { TOKEN: "one" } });

      await service.openStored({ userId: "user-1", dseq: "1420000", sealedSecrets: SEAL });

      expect(secretCipherService.decrypt).toHaveBeenCalledWith("user-1", SEAL, { sub: "user-1", dseq: "1420000" });
    });

    it("returns every value the token carries", async () => {
      const secrets = { TOKEN: faker.string.alphanumeric(32), DATABASE_URL: `postgres://app:${faker.string.alphanumeric(16)}@db/app` };
      const { service } = setup({ stored: secrets });

      await expect(service.openStored({ userId: "user-1", dseq: "1420000", sealedSecrets: SEAL })).resolves.toEqual(secrets);
    });

    it("says nothing about a value in what it logs", async () => {
      const value = faker.string.alphanumeric(32);
      const { service, logger } = setup({ stored: { TOKEN: value } });

      await service.openStored({ userId: "user-1", dseq: "1420000", sealedSecrets: SEAL });

      expect(logger.info).toHaveBeenCalledWith({ event: "SDL_SECRETS_STORED_OPENED", userId: "user-1", dseq: "1420000", secretCount: 1 });
    });

    it("refuses a payload that is not a flat set of string values", async () => {
      const { service, secretCipherService } = setup();
      secretCipherService.decrypt.mockResolvedValue(JSON.stringify({ TOKEN: { nested: "one" } }));

      await expect(service.openStored({ userId: "user-1", dseq: "1420000", sealedSecrets: SEAL })).rejects.toMatchObject({ status: 500 });
    });

    it("refuses a payload that is not json at all", async () => {
      const { service, secretCipherService } = setup();
      secretCipherService.decrypt.mockResolvedValue("not-json");

      await expect(service.openStored({ userId: "user-1", dseq: "1420000", sealedSecrets: SEAL })).rejects.toMatchObject({ status: 500 });
    });

    it("logs a payload it cannot read as the fault of the console that wrote it", async () => {
      const { service, secretCipherService, logger } = setup();
      secretCipherService.decrypt.mockResolvedValue("[]");

      await expect(service.openStored({ userId: "user-1", dseq: "1420000", sealedSecrets: SEAL })).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith({ event: "SDL_SECRETS_STORED_PAYLOAD_INVALID", userId: "user-1", dseq: "1420000" });
    });

    it("lets a token the cipher refuses fail untouched", async () => {
      const refusal = Object.assign(new Error("Unable to read the stored value"), { status: 500 });
      const { service, secretCipherService } = setup();
      secretCipherService.decrypt.mockRejectedValue(refusal);

      await expect(service.openStored({ userId: "user-1", dseq: "1420000", sealedSecrets: SEAL })).rejects.toBe(refusal);
    });
  });

  function receivedOf(result: Awaited<ReturnType<SdlSecretsService["receive"]>>) {
    return (result as Extract<typeof result, { ok: true }>).value;
  }

  function errorsOf(result: Awaited<ReturnType<SdlSecretsService["receive"]>>) {
    return (result as Extract<typeof result, { ok: false }>).value;
  }

  function setup(input?: { supplied?: SdlSecrets; stored?: SdlSecrets; maxCount?: number; maxValueBytes?: number }) {
    const unsealerService = mock<SdlSecretsUnsealerService>({ open: vi.fn().mockResolvedValue(input?.supplied ?? {}) });
    const secretCipherService = mock<SecretCipherService>({
      encrypt: vi.fn().mockResolvedValue("encrypted"),
      decrypt: vi.fn().mockResolvedValue(JSON.stringify(input?.stored ?? {}))
    });
    const config = mockConfigService<DeploymentConfigService>({
      SDL_SECRETS_MAX_COUNT: input?.maxCount ?? MAX_COUNT,
      SDL_SECRETS_MAX_VALUE_BYTES: input?.maxValueBytes ?? MAX_VALUE_BYTES
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const sdlReferenceService = new SdlReferenceService();
    const service = new SdlSecretsService(unsealerService, sdlReferenceService, secretCipherService, config, () => logger);

    return { service, unsealerService, secretCipherService, logger, config };
  }
});
