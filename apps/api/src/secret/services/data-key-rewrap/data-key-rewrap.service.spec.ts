import { protos } from "@google-cloud/kms";
import crc32c from "fast-crc32c";
import { compactDecrypt, decodeProtectedHeader } from "jose";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { TxService } from "@src/core/services";
import type { SdlSecretsKmsClient, SdlSecretsKmsTargetFactory } from "@src/deployment/providers/kms.provider";
import { createSdlSecretsKmsTarget } from "@src/deployment/providers/kms.provider";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { KmsWrappedJweService,ParsedKmsWrappedJwe  } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import { KmsWrappedJweError } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import type { DataKeyOutput, DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyRewrapService } from "./data-key-rewrap.service";

const { CryptoKeyVersionState } = protos.google.cloud.kms.v1.CryptoKeyVersion;

const KEY = "sdl-secrets";
const TARGET_VERSION = "3";
const TARGET_KID = `${KEY}.v${TARGET_VERSION}`;
const SOURCE_KID = `${KEY}.v1`;
const OTHER_SOURCE_KID = `${KEY}.v2`;

const DATA_KEY = randomBytes(32);
const SEALING_KEYPAIR = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SEALING_KEY_PEM = SEALING_KEYPAIR.publicKey.export({ type: "spki", format: "pem" }).toString();

const A_TOKEN = "eyJhbGciOiJkaXIifQ..YWxwaGEtaXY.YWxwaGEtY2lwaGVydGV4dA.YWxwaGEtdGFn";
const ANOTHER_TOKEN = "eyJhbGciOiJkaXIifQ..Z2FtbWEtaXY.Z2FtbWEtY2lwaGVydGV4dA.Z2FtbWEtdGFn";

describe(DataKeyRewrapService.name, () => {
  describe("target version", () => {
    it("refuses a version the key service reports as disabled, before touching a row", async () => {
      const { service, dataKeyRepository } = setup({ versionState: "DISABLED" });

      await expect(service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false })).rejects.toThrow();

      expect(dataKeyRepository.updateById).not.toHaveBeenCalled();
      expect(dataKeyRepository.findWrappedUnderOtherVersionsIteratively).not.toHaveBeenCalled();
    });

    it("accepts the enabled state reported as an ordinal rather than a name", async () => {
      const { service } = setup({ versionState: CryptoKeyVersionState.ENABLED });

      await expect(service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: true })).resolves.toBeDefined();
    });

    it("refuses a batch size below one, which would read as a fleet needing no work", async () => {
      const { service, dataKeyRepository } = setup({});

      await expect(service.rewrapDataKeys({ targetVersion: TARGET_VERSION, batchSize: 0, dryRun: false })).rejects.toThrow();

      expect(dataKeyRepository.findWrappedUnderOtherVersionsIteratively).not.toHaveBeenCalled();
    });
  });

  describe("re-wrapping", () => {
    it("moves every row not already at the target onto it", async () => {
      const { service, dataKeyRepository, rows } = setup({ rows: [aRow({ wrappedByKid: SOURCE_KID }), aRow({ wrappedByKid: OTHER_SOURCE_KID })] });

      await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false });

      expect(dataKeyRepository.updateById).toHaveBeenCalledTimes(2);
      for (const row of rows) {
        expect(dataKeyRepository.updateById).toHaveBeenCalledWith(row.id, { wrappedKey: expect.any(String), wrappedByKid: TARGET_KID });
      }
    });

    it("writes a wrapping whose own header names the target version, so the column and the blob agree", async () => {
      const { service, writtenKeys } = setup({ rows: [aRow({ wrappedByKid: SOURCE_KID })] });

      await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false });

      expect(decodeProtectedHeader(writtenKeys()[0]).kid).toBe(TARGET_KID);
    });

    it("carries every other header claim across unchanged", async () => {
      const { service, writtenKeys } = setup({ rows: [aRow({ wrappedByKid: SOURCE_KID })] });

      await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false });

      expect(decodeProtectedHeader(writtenKeys()[0])).toEqual({ alg: "RSA-OAEP-256", enc: "A256GCM", cty: "application/octet-stream", kid: TARGET_KID });
    });

    it("wraps the very same data key bytes, so no stored secret stops opening", async () => {
      const { service, writtenKeys } = setup({ rows: [aRow({ wrappedByKid: SOURCE_KID })] });

      await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false });

      const { plaintext } = await compactDecrypt(writtenKeys()[0], SEALING_KEYPAIR.privateKey);
      expect(Buffer.from(plaintext).equals(DATA_KEY)).toBe(true);
    });

    it("opens each row under the version its own header names, not under the target", async () => {
      const { service, wrappedJweService } = setup({ rows: [aRow({ wrappedByKid: OTHER_SOURCE_KID })] });

      await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false });

      expect(wrappedJweService.open).toHaveBeenCalledWith(expect.anything(), versionPath("2"));
    });

    it("commits each batch in its own transaction", async () => {
      const { service, txService } = setup({ rows: [aRow({}), aRow({}), aRow({})] });

      await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, batchSize: 2, dryRun: false });

      expect(txService.transaction).toHaveBeenCalledTimes(2);
    });

    it("selects in batches of the size asked for, and of a default when none is given", async () => {
      const { service, dataKeyRepository } = setup({});

      await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, batchSize: 25, dryRun: false });
      await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false });

      expect(dataKeyRepository.findWrappedUnderOtherVersionsIteratively).toHaveBeenNthCalledWith(1, { targetKid: TARGET_KID, batchSize: 25 });
      expect(dataKeyRepository.findWrappedUnderOtherVersionsIteratively).toHaveBeenNthCalledWith(2, { targetKid: TARGET_KID, batchSize: 100 });
    });
  });

  describe("a row that cannot be opened", () => {
    it("records it, re-wraps the rest of its batch and reports the run as failed", async () => {
      const unopenable = aRow({ wrappedByKid: SOURCE_KID });
      const { service, dataKeyRepository } = setup({ rows: [unopenable, aRow({ wrappedByKid: SOURCE_KID })], unopenableIds: [unopenable.id] });

      const result = await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false });

      expect(result.err).toBe(true);
      expect(dataKeyRepository.updateById).toHaveBeenCalledTimes(1);
      expect(dataKeyRepository.updateById).not.toHaveBeenCalledWith(unopenable.id, expect.anything());
    });

    it("names it in an event so the operator knows which row blocks the version", async () => {
      const unopenable = aRow({ wrappedByKid: SOURCE_KID });
      const { service, logger } = setup({ rows: [unopenable], unopenableIds: [unopenable.id] });

      await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false });

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: "DATA_KEY_REWRAP_ROW_FAILED", dataKeyId: unopenable.id, wrappedByKid: SOURCE_KID })
      );
    });

    it("treats a kid of another crypto key as unopenable rather than wrapping it", async () => {
      const foreign = aRow({ wrappedByKid: "someone-elses-key.v1" });
      const { service, dataKeyRepository } = setup({ rows: [foreign] });

      const result = await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false });

      expect(result.err).toBe(true);
      expect(dataKeyRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe("the report", () => {
    it("states the census, the work done and the fingerprint", async () => {
      const { service, report, writtenKeys } = setup({
        rows: [aRow({ wrappedByKid: SOURCE_KID }), aRow({ wrappedByKid: SOURCE_KID })],
        census: [
          { wrappedByKid: SOURCE_KID, count: 2 },
          { wrappedByKid: TARGET_KID, count: 1 }
        ],
        storedSecrets: [
          { id: "a", sealedSecrets: A_TOKEN },
          { id: "b", sealedSecrets: ANOTHER_TOKEN }
        ]
      });

      const summary = report(await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false }));

      expect(summary).toMatchObject({
        dryRun: false,
        toVersion: TARGET_KID,
        fromVersions: [SOURCE_KID],
        census: { [SOURCE_KID]: 2, [TARGET_KID]: 1 },
        dataKeysRewrapped: 2,
        dataKeysFailed: 0,
        secretsReEncrypted: 0,
        bytesRewritten: writtenKeys().reduce((total, key) => total + Buffer.byteLength(key), 0),
        fingerprint: {
          before: { rowCount: 2, byteCount: A_TOKEN.length + ANOTHER_TOKEN.length },
          after: { rowCount: 2, byteCount: A_TOKEN.length + ANOTHER_TOKEN.length }
        }
      });
      expect(summary.fingerprint.after?.digest).toBe(summary.fingerprint.before.digest);
      expect(summary.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    it("marks the run's start and completion with structured events", async () => {
      const { service, logger } = setup({ rows: [aRow({})] });

      await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false });

      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "DATA_KEY_REWRAP_START", toVersion: TARGET_KID, dryRun: false }));
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "DATA_KEY_REWRAP_END", report: expect.objectContaining({ toVersion: TARGET_KID }) }));
    });

    it("carries no key material and no secret value into any event", async () => {
      const row = aRow({ wrappedByKid: SOURCE_KID });
      const { service, logger, writtenKeys } = setup({ rows: [row], storedSecrets: [{ id: "a", sealedSecrets: A_TOKEN }] });

      await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false });

      const logged = JSON.stringify([...logger.info.mock.calls, ...logger.error.mock.calls, ...logger.warn.mock.calls]);
      expect(logged).not.toContain(row.wrappedKey);
      expect(logged).not.toContain(writtenKeys()[0]);
      expect(logged).not.toContain(A_TOKEN);
      expect(logged).not.toContain(DATA_KEY.toString("base64"));
    });
  });

  describe("dry run", () => {
    it("writes nothing and reports what a real run would move", async () => {
      const { service, report, dataKeyRepository, txService } = setup({
        census: [
          { wrappedByKid: SOURCE_KID, count: 2 },
          { wrappedByKid: TARGET_KID, count: 1 }
        ]
      });

      const summary = report(await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: true }));

      expect(dataKeyRepository.updateById).not.toHaveBeenCalled();
      expect(dataKeyRepository.findWrappedUnderOtherVersionsIteratively).not.toHaveBeenCalled();
      expect(txService.transaction).not.toHaveBeenCalled();
      expect(summary).toMatchObject({ dryRun: true, dataKeysRewrapped: 2, census: { [SOURCE_KID]: 2, [TARGET_KID]: 1 } });
    });

    it("fingerprints the fleet once and reports no after, since nothing happened between", async () => {
      const { service, report } = setup({ storedSecrets: [{ id: "a", sealedSecrets: A_TOKEN }] });

      const summary = report(await service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: true }));

      expect(summary.fingerprint.before).toMatchObject({ rowCount: 1, byteCount: A_TOKEN.length });
      expect(summary.fingerprint.after).toBeUndefined();
    });
  });

  describe("when a stored secret changed under the run", () => {
    it("fails hard rather than reporting a rotation that proved nothing", async () => {
      const { service } = setup({
        rows: [aRow({})],
        storedSecrets: [{ id: "a", sealedSecrets: A_TOKEN }],
        storedSecretsAfter: [{ id: "a", sealedSecrets: ANOTHER_TOKEN }]
      });

      await expect(service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false })).rejects.toThrow();
    });

    it("reports how many stored secrets moved, which a row count alone cannot show", async () => {
      const { service, logger } = setup({
        rows: [aRow({})],
        storedSecrets: [
          { id: "a", sealedSecrets: A_TOKEN },
          { id: "b", sealedSecrets: A_TOKEN }
        ],
        storedSecretsAfter: [
          { id: "a", sealedSecrets: ANOTHER_TOKEN },
          { id: "b", sealedSecrets: A_TOKEN }
        ]
      });

      await expect(service.rewrapDataKeys({ targetVersion: TARGET_VERSION, dryRun: false })).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ event: "DATA_KEY_REWRAP_FINGERPRINT_MISMATCH", report: expect.objectContaining({ secretsReEncrypted: 1 }) })
      );
    });
  });

  function versionPath(version: string) {
    return `projects/console-test/locations/global/keyRings/console-api/cryptoKeys/${KEY}/cryptoKeyVersions/${version}`;
  }

  function aRow(overrides: Partial<DataKeyOutput>): DataKeyOutput {
    const id = overrides.id ?? randomUUID();

    return {
      id,
      userId: overrides.userId ?? randomUUID(),
      wrappedKey: overrides.wrappedKey ?? `wrapped-${id}`,
      wrappedByKid: overrides.wrappedByKid ?? SOURCE_KID,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  function setup(input: {
    rows?: DataKeyOutput[];
    census?: Array<{ wrappedByKid: string; count: number }>;
    storedSecrets?: Array<{ id: string; sealedSecrets: string }>;
    storedSecretsAfter?: Array<{ id: string; sealedSecrets: string }>;
    unopenableIds?: string[];
    versionState?: protos.google.cloud.kms.v1.ICryptoKeyVersion["state"];
  }) {
    const rows = input.rows ?? [];
    const client = mock<SdlSecretsKmsClient>();
    client.getCryptoKeyVersion.mockResolvedValue([{ name: versionPath(TARGET_VERSION), state: input.versionState ?? "ENABLED" }]);
    client.getPublicKey.mockResolvedValue([
      {
        name: versionPath(TARGET_VERSION),
        pem: SEALING_KEY_PEM,
        pemCrc32c: { value: crc32c.calculate(SEALING_KEY_PEM) },
        algorithm: "RSA_DECRYPT_OAEP_2048_SHA256"
      }
    ]);

    const createKmsTarget: SdlSecretsKmsTargetFactory = version => createSdlSecretsKmsTarget({ client, versionPath, key: KEY, version });

    const rowByHeader = new Map<Record<string, unknown>, DataKeyOutput>();
    const wrappedJweService = mock<KmsWrappedJweService>();
    wrappedJweService.parse.mockImplementation(serialized => {
      const row = rows.find(candidate => candidate.wrappedKey === serialized)!;
      const header = { alg: "RSA-OAEP-256", enc: "A256GCM", cty: "application/octet-stream", kid: row.wrappedByKid };
      rowByHeader.set(header, row);

      return { header, segments: mock<ParsedKmsWrappedJwe["segments"]>() } as unknown as ParsedKmsWrappedJwe;
    });
    wrappedJweService.open.mockImplementation(async parsed => {
      if (input.unopenableIds?.includes(rowByHeader.get(parsed.header)!.id)) {
        throw new KmsWrappedJweError("WRAPPING_VERSION_UNUSABLE");
      }

      return DATA_KEY;
    });

    const dataKeyRepository = mock<DataKeyRepository>();
    dataKeyRepository.countByWrappingVersion.mockResolvedValue(input.census ?? [{ wrappedByKid: SOURCE_KID, count: rows.length }]);
    dataKeyRepository.findWrappedUnderOtherVersionsIteratively.mockImplementation(async function* ({ batchSize }) {
      for (let offset = 0; offset < rows.length; offset += batchSize) {
        yield rows.slice(offset, offset + batchSize);
      }
    });

    let scans = 0;
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findStoredSecretsIteratively.mockImplementation(async function* () {
      const scanned = scans++ === 0 ? (input.storedSecrets ?? []) : (input.storedSecretsAfter ?? input.storedSecrets ?? []);

      if (scanned.length) yield scanned;
    });

    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async callback => await callback());

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new DataKeyRewrapService(dataKeyRepository, deploymentSettingRepository, wrappedJweService, txService, createKmsTarget, createLogger);

    return {
      service,
      dataKeyRepository,
      deploymentSettingRepository,
      wrappedJweService,
      txService,
      client,
      logger,
      rows,
      writtenKeys: () => dataKeyRepository.updateById.mock.calls.map(([, payload]) => payload.wrappedKey as string),
      report: (result: Awaited<ReturnType<typeof service.rewrapDataKeys>>) => result.unwrap()
    };
  }
});
