import { generateKeyPairSync, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { TxService } from "@src/core/services";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { DeploymentSettingRepository, DeploymentStoredSecretsOfUser } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import type { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import type { DataKeyOutput, DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { DataKeyRekeyService, MIN_RETIREMENT_AGE_BEFORE_DELETE_MS } from "./data-key-rekey.service";

import { createDataKey } from "@test/seeders/data-key.seeder";

const USER_ID = "3f2b6f7a-1c1d-4b0e-8b8a-9a0f5f5c2b11";
const ACTIVE_KEY_ID = "2b0f1e3c-8a4d-4c22-9f10-7d5e6a1b2c3d";
const RETIRED_KEY_ID = "9c8b7a65-4321-4def-8abc-0123456789ab";
const REPLACEMENT_KEY_ID = "5d4c3b2a-1111-4222-8333-444455556666";
const FOREIGN_KEY_ID = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";
const SEALING_KEY_PAIR = generateKeyPairSync("rsa", { modulusLength: 2048 });
const TWO_SECRETS = { DB_URL: "postgres://db", API_TOKEN: "token" };

/** Only the protected header is read off a stored token, so four opaque segments behind it are enough. */
function tokenUnder(kid: string, nonce: string = randomUUID()) {
  const header = Buffer.from(JSON.stringify({ sub: USER_ID, dseq: nonce, alg: "dir", enc: "A256GCM", kid })).toString("base64url");

  return `${header}..iv.${Buffer.from(nonce).toString("base64url")}.tag`;
}

function deploymentSealedUnder(kid: string, dseq = String(1000 + Math.floor(Math.random() * 9000))): DeploymentStoredSecretsOfUser {
  return { id: randomUUID(), dseq, sealedSecrets: tokenUnder(kid), updatedAt: new Date() };
}

describe(DataKeyRekeyService.name, () => {
  describe("refusals", () => {
    it("refuses a user that does not exist, before touching a key", async () => {
      const { service, dataKeyRepository } = setup({ userExists: false });

      await expect(service.rekeyUser({ userId: USER_ID, dryRun: false })).rejects.toThrow(USER_ID);

      expect(dataKeyRepository.retireIfActive).not.toHaveBeenCalled();
    });

    it("refuses a user holding no data key", async () => {
      const { service, logger } = setup({ active: undefined });

      await expect(service.rekeyUser({ userId: USER_ID, dryRun: false })).rejects.toThrow("no data key");

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DATA_KEY_REKEY_NO_ACTIVE_KEY" }));
    });

    it("refuses a user left with several retired keys, which two interrupted runs would leave", async () => {
      const { service, dataKeyRepository } = setup({
        retired: [createDataKey({ id: RETIRED_KEY_ID, userId: USER_ID, retiredAt: new Date() }), createDataKey({ userId: USER_ID, retiredAt: new Date() })]
      });

      await expect(service.rekeyUser({ userId: USER_ID, dryRun: false })).rejects.toThrow("retired data keys");

      expect(dataKeyRepository.retireIfActive).not.toHaveBeenCalled();
    });
  });

  describe("a fresh run", () => {
    it("retires the active key and inserts its replacement inside one transaction", async () => {
      const { service, dataKeyRepository, txService } = setup({});

      await service.rekeyUser({ userId: USER_ID, dryRun: false });

      expect(txService.transaction).toHaveBeenCalledTimes(1);
      expect(dataKeyRepository.retireIfActive).toHaveBeenCalledWith(ACTIVE_KEY_ID);
      expect(dataKeyRepository.create).toHaveBeenCalledWith({ userId: USER_ID, wrappedKey: expect.any(String), wrappedByKid: "sdl-secrets.v1" });
    });

    it("refuses to continue when another writer retired the key first", async () => {
      const { service, dataKeyRepository } = setup({ activeMovedBeforeRetire: true });

      await expect(service.rekeyUser({ userId: USER_ID, dryRun: false })).rejects.toThrow("another writer");

      expect(dataKeyRepository.create).not.toHaveBeenCalled();
    });

    it("opens each stored value bound to its own deployment and seals it again under the replacement", async () => {
      const first = deploymentSealedUnder(ACTIVE_KEY_ID, "100");
      const second = deploymentSealedUnder(ACTIVE_KEY_ID, "200");
      const { service, sdlSecretsService, deploymentSettingRepository, resealedTokens } = setup({ deployments: [first, second] });

      const report = (await service.rekeyUser({ userId: USER_ID, dryRun: false })).unwrap();

      expect(sdlSecretsService.openStored).toHaveBeenCalledWith({ userId: USER_ID, dseq: "100", sealedSecrets: first.sealedSecrets });
      expect(sdlSecretsService.sealForStorage).toHaveBeenCalledWith({ userId: USER_ID, dseq: "100", secrets: TWO_SECRETS });
      expect(deploymentSettingRepository.resealIfUnchanged).toHaveBeenCalledWith(first.id, first.sealedSecrets, resealedTokens()[0]);
      expect(report).toMatchObject({ deploymentsResealed: 2, secretsResealed: 4, activeDataKeyId: REPLACEMENT_KEY_ID, retiredDataKeyId: ACTIVE_KEY_ID });
    });

    it("keeps the retired key when it was retired less than a minute ago, and says when it may go", async () => {
      const { service, dataKeyRepository, retiredAt } = setup({ deployments: [deploymentSealedUnder(ACTIVE_KEY_ID)] });

      const report = (await service.rekeyUser({ userId: USER_ID, dryRun: false })).unwrap();

      expect(dataKeyRepository.deleteRetired).not.toHaveBeenCalled();
      expect(report.retiredDataKeyDeleted).toBe(false);
      expect(report.retiredDataKeyDeletableAfter).toEqual(new Date(retiredAt.getTime() + MIN_RETIREMENT_AGE_BEFORE_DELETE_MS));
    });
  });

  describe("a resumed run", () => {
    it("retires nothing when a retired key is already waiting", async () => {
      const { service, dataKeyRepository } = setup({ retired: [retiredKey(new Date())] });

      await service.rekeyUser({ userId: USER_ID, dryRun: false });

      expect(dataKeyRepository.retireIfActive).not.toHaveBeenCalled();
      expect(dataKeyRepository.create).not.toHaveBeenCalled();
    });

    it("re-seals what is still under the retired key and counts what already moved", async () => {
      const { service } = setup({
        retired: [retiredKey(new Date())],
        deployments: [deploymentSealedUnder(RETIRED_KEY_ID), deploymentSealedUnder(ACTIVE_KEY_ID), deploymentSealedUnder(ACTIVE_KEY_ID)]
      });

      const report = (await service.rekeyUser({ userId: USER_ID, dryRun: false })).unwrap();

      expect(report).toMatchObject({
        deploymentsResealed: 1,
        deploymentsAlreadyUnderActiveKey: 2,
        retiredDataKeyId: RETIRED_KEY_ID,
        activeDataKeyId: ACTIVE_KEY_ID
      });
    });

    it("deletes the retired key once it is old enough and a fresh scan finds nothing under it", async () => {
      const { service, dataKeyRepository } = setup({ retired: [retiredKey(twoMinutesAgo())], deployments: [deploymentSealedUnder(RETIRED_KEY_ID)] });

      const report = (await service.rekeyUser({ userId: USER_ID, dryRun: false })).unwrap();

      expect(dataKeyRepository.deleteRetired).toHaveBeenCalledWith(RETIRED_KEY_ID);
      expect(report.retiredDataKeyDeleted).toBe(true);
    });

    it("deletes the retired key when the fresh scan finds only deployments already under the replacement", async () => {
      const { service, dataKeyRepository } = setup({
        retired: [retiredKey(twoMinutesAgo())],
        deployments: [deploymentSealedUnder(RETIRED_KEY_ID)],
        deploymentsAfter: [deploymentSealedUnder(ACTIVE_KEY_ID), deploymentSealedUnder(ACTIVE_KEY_ID)]
      });

      const report = (await service.rekeyUser({ userId: USER_ID, dryRun: false })).unwrap();

      expect(report).toMatchObject({ deploymentsResealed: 1, retiredDataKeyDeleted: true });
      expect(dataKeyRepository.deleteRetired).toHaveBeenCalledExactlyOnceWith(RETIRED_KEY_ID);
    });

    it("walks the user's deployments in batches of the size it was given", async () => {
      const { service, deploymentSettingRepository } = setup({ retired: [retiredKey(twoMinutesAgo())], deployments: [deploymentSealedUnder(RETIRED_KEY_ID)] });

      await service.rekeyUser({ userId: USER_ID, dryRun: false, batchSize: 7 });

      expect(deploymentSettingRepository.findStoredSecretsByUserIteratively).toHaveBeenCalledWith({ userId: USER_ID, batchSize: 7 });
    });

    it("keeps the retired key while a fresh scan still finds a deployment sealed under it", async () => {
      const { service, dataKeyRepository, logger } = setup({
        retired: [retiredKey(twoMinutesAgo())],
        deployments: [deploymentSealedUnder(RETIRED_KEY_ID)],
        deploymentsAfter: [deploymentSealedUnder(RETIRED_KEY_ID)]
      });

      const report = (await service.rekeyUser({ userId: USER_ID, dryRun: false })).unwrap();

      expect(dataKeyRepository.deleteRetired).not.toHaveBeenCalled();
      expect(report.retiredDataKeyDeleted).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: "DATA_KEY_REKEY_RETIRED_KEY_KEPT", reason: expect.stringContaining("still sealed") })
      );
    });
  });

  describe("what a pass leaves behind", () => {
    it("counts a deployment the user rewrote during the pass instead of overwriting it, and keeps the key", async () => {
      const moved = deploymentSealedUnder(ACTIVE_KEY_ID);
      const { service, dataKeyRepository } = setup({ deployments: [moved], movedIds: [moved.id], retireAgeMs: MIN_RETIREMENT_AGE_BEFORE_DELETE_MS * 2 });

      const report = (await service.rekeyUser({ userId: USER_ID, dryRun: false })).unwrap();

      expect(report).toMatchObject({ deploymentsResealed: 0, deploymentsMovedByAnotherWriter: 1, retiredDataKeyDeleted: false });
      expect(dataKeyRepository.deleteRetired).not.toHaveBeenCalled();
    });

    it("names a deployment sealed under a key that is neither of the user's, fails the run and keeps the retired key", async () => {
      const stray = deploymentSealedUnder(FOREIGN_KEY_ID, "777");
      const { service, dataKeyRepository, logger } = setup({ deployments: [stray], retireAgeMs: MIN_RETIREMENT_AGE_BEFORE_DELETE_MS * 2 });

      const result = await service.rekeyUser({ userId: USER_ID, dryRun: false });

      expect(result.err).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "DATA_KEY_REKEY_END",
          report: expect.objectContaining({ deploymentsUnderUnknownKey: ["777"], retiredDataKeyDeleted: false })
        })
      );
      expect(dataKeyRepository.deleteRetired).not.toHaveBeenCalled();
    });

    it("records a value that would not open, steps over it and fails the run at the end", async () => {
      const unreadable = deploymentSealedUnder(ACTIVE_KEY_ID, "300");
      const readable = deploymentSealedUnder(ACTIVE_KEY_ID, "400");
      const { service, logger } = setup({ deployments: [unreadable, readable], unopenableDseqs: ["300"] });

      const result = await service.rekeyUser({ userId: USER_ID, dryRun: false });

      expect(result.err).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DATA_KEY_REKEY_DEPLOYMENT_FAILED", dseq: "300" }));
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: "DATA_KEY_REKEY_END", report: expect.objectContaining({ deploymentsResealed: 1 }) })
      );
    });
  });

  describe("a dry run", () => {
    it("retires nothing, writes nothing and reports what a real run would re-seal", async () => {
      const { service, dataKeyRepository, deploymentSettingRepository, sdlSecretsService } = setup({
        deployments: [deploymentSealedUnder(ACTIVE_KEY_ID), deploymentSealedUnder(ACTIVE_KEY_ID)]
      });

      const report = (await service.rekeyUser({ userId: USER_ID, dryRun: true })).unwrap();

      expect(report).toMatchObject({
        dryRun: true,
        deploymentsResealed: 2,
        secretsResealed: 4,
        retiredDataKeyId: null,
        activeDataKeyId: ACTIVE_KEY_ID,
        retiredDataKeyDeleted: false
      });
      expect(dataKeyRepository.retireIfActive).not.toHaveBeenCalled();
      expect(dataKeyRepository.create).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.resealIfUnchanged).not.toHaveBeenCalled();
      expect(sdlSecretsService.sealForStorage).not.toHaveBeenCalled();
    });

    it("opens every value it would re-seal, so one that would not open fails the preview", async () => {
      const { service, logger, deploymentSettingRepository } = setup({
        deployments: [deploymentSealedUnder(ACTIVE_KEY_ID, "300"), deploymentSealedUnder(ACTIVE_KEY_ID, "400")],
        unopenableDseqs: ["300"]
      });

      const result = await service.rekeyUser({ userId: USER_ID, dryRun: true });

      expect(result.err).toBe(true);
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DATA_KEY_REKEY_DEPLOYMENT_FAILED", dseq: "300" }));
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: "DATA_KEY_REKEY_END", report: expect.objectContaining({ deploymentsResealed: 1, secretsResealed: 2 }) })
      );
      expect(deploymentSettingRepository.resealIfUnchanged).not.toHaveBeenCalled();
    });

    it("names a deployment whose token has no readable data key instead of counting it as already moved", async () => {
      const unreadable: DeploymentStoredSecretsOfUser = { id: randomUUID(), dseq: "555", sealedSecrets: "not-a-token", updatedAt: new Date() };
      const { service, logger } = setup({ deployments: [unreadable, deploymentSealedUnder(ACTIVE_KEY_ID)] });

      const result = await service.rekeyUser({ userId: USER_ID, dryRun: true });

      expect(result.err).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "DATA_KEY_REKEY_END",
          report: expect.objectContaining({ deploymentsUnderUnknownKey: ["555"], deploymentsAlreadyUnderActiveKey: 0, deploymentsResealed: 1 })
        })
      );
    });

    it("deletes nothing on a resumed dry run, however old the retired key is", async () => {
      const { service, dataKeyRepository } = setup({ retired: [retiredKey(twoMinutesAgo())], deployments: [deploymentSealedUnder(ACTIVE_KEY_ID)] });

      const report = (await service.rekeyUser({ userId: USER_ID, dryRun: true })).unwrap();

      expect(report).toMatchObject({ deploymentsAlreadyUnderActiveKey: 1, retiredDataKeyDeleted: false });
      expect(dataKeyRepository.deleteRetired).not.toHaveBeenCalled();
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup({});

    expect(createLogger).toHaveBeenCalledWith({ context: DataKeyRekeyService.name });
  });

  function twoMinutesAgo() {
    return new Date(Date.now() - 2 * MIN_RETIREMENT_AGE_BEFORE_DELETE_MS);
  }

  function retiredKey(retiredAt: Date) {
    return createDataKey({ id: RETIRED_KEY_ID, userId: USER_ID, retiredAt });
  }

  function setup(input: {
    userExists?: boolean;
    active?: DataKeyOutput | undefined;
    retired?: DataKeyOutput[];
    deployments?: DeploymentStoredSecretsOfUser[];
    deploymentsAfter?: DeploymentStoredSecretsOfUser[];
    movedIds?: string[];
    unopenableDseqs?: string[];
    activeMovedBeforeRetire?: boolean;
    retireAgeMs?: number;
  }) {
    const active = "active" in input ? input.active : createDataKey({ id: ACTIVE_KEY_ID, userId: USER_ID });
    const retiredAt = new Date(Date.now() - (input.retireAgeMs ?? 0));

    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(input.userExists === false ? undefined : mock<UserOutput>({ id: USER_ID }));

    const dataKeyRepository = mock<DataKeyRepository>();
    dataKeyRepository.findByUserId.mockResolvedValue(active);
    dataKeyRepository.findRetiredByUserId.mockResolvedValue(input.retired ?? []);
    dataKeyRepository.retireIfActive.mockImplementation(async id => (input.activeMovedBeforeRetire || !active ? undefined : { ...active, id, retiredAt }));
    dataKeyRepository.create.mockImplementation(async row => createDataKey({ ...row, id: REPLACEMENT_KEY_ID }));
    dataKeyRepository.deleteRetired.mockResolvedValue(true);

    let scans = 0;
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findStoredSecretsByUserIteratively.mockImplementation(async function* () {
      const scanned = scans++ === 0 ? input.deployments ?? [] : input.deploymentsAfter ?? [];

      if (scanned.length) yield scanned;
    });
    deploymentSettingRepository.resealIfUnchanged.mockImplementation(async id => !input.movedIds?.includes(id));

    const sdlSecretsService = mock<SdlSecretsService>();
    sdlSecretsService.openStored.mockImplementation(async ({ dseq }) => {
      if (input.unopenableDseqs?.includes(dseq)) throw new Error(`deployment ${dseq} would not open`);

      return TWO_SECRETS;
    });
    const resealed: string[] = [];
    sdlSecretsService.sealForStorage.mockImplementation(async ({ dseq }) => {
      const token = tokenUnder(input.retired?.length ? ACTIVE_KEY_ID : REPLACEMENT_KEY_ID, dseq);
      resealed.push(token);

      return token;
    });

    const sealingKeyService = mock<SdlSecretsSealingKeyService>();
    const { n, e } = SEALING_KEY_PAIR.publicKey.export({ format: "jwk" });
    sealingKeyService.getSealingKey.mockResolvedValue({
      kid: "sdl-secrets.v1",
      publicKey: SEALING_KEY_PAIR.publicKey,
      jwk: { kty: "RSA", n: n!, e: e!, use: "enc", alg: "RSA-OAEP-256" }
    });

    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async callback => await callback());

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const executionContextService = new ExecutionContextService(createLogger);

    const service = new DataKeyRekeyService(
      dataKeyRepository,
      deploymentSettingRepository,
      userRepository,
      sdlSecretsService,
      sealingKeyService,
      txService,
      executionContextService,
      createLogger
    );

    return {
      service,
      createLogger,
      logger,
      dataKeyRepository,
      deploymentSettingRepository,
      sdlSecretsService,
      txService,
      retiredAt,
      resealedTokens: () => resealed
    };
  }
});
