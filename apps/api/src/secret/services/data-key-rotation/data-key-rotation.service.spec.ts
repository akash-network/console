import type { protos } from "@google-cloud/kms";
import crc32c from "fast-crc32c";
import { grpc } from "google-gax";
import { compactDecrypt, CompactEncrypt, decodeProtectedHeader } from "jose";
import { constants, generateKeyPairSync, privateDecrypt, randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { TxService } from "@src/core/services";
import type { SdlSecretsKmsClient } from "@src/deployment/providers/kms.provider";
import { KmsWrappedJweService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import type { StoredSecretFingerprintService } from "@src/deployment/services/stored-secret-fingerprint/stored-secret-fingerprint.service";
import type { DataKeyOutput } from "@src/secret/repositories/data-key/data-key.repository";
import type { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyRotationService } from "./data-key-rotation.service";

import { createTestSdlSecretsKmsTarget } from "@test/mocks/sdl-secrets-kms.mock";

const TARGET_VERSION = "2";
const TARGET_KID = "sdl-secrets.v2";
const PREVIOUS_KID = "sdl-secrets.v1";

const keyPairs = new Map(["1", TARGET_VERSION].map(version => [version, generateKeyPairSync("rsa", { modulusLength: 3072 })]));

function keyPairOf(version: string) {
  return keyPairs.get(version.split("/").pop()!)!;
}

describe(DataKeyRotationService.name, () => {
  it("refuses a target version that is not the one the console wraps under", async () => {
    const { service, fingerprintService, kmsClient, logger } = setup();

    const result = await service.rotate({ targetVersion: "3", dryRun: false });

    expect(result.val).toMatchObject({ reason: `Requested target version 3 is not the configured one, ${TARGET_VERSION}` });
    expect(logger.error).toHaveBeenCalledWith({ event: "KEY_ROTATION_TARGET_VERSION_MISMATCH", requested: "3", configured: TARGET_VERSION });
    expect(fingerprintService.take).not.toHaveBeenCalled();
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("refuses a target version the key service reports as anything but enabled", async () => {
    const { service, fingerprintService, kmsClient, dataKeyRepository, kmsTarget, logger } = setup({ targetVersionState: "DISABLED" });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: false });

    expect(result.val).toMatchObject({ reason: `Target key version ${TARGET_KID} is DISABLED rather than enabled` });
    expect(logger.error).toHaveBeenCalledWith({ event: "KEY_ROTATION_TARGET_VERSION_UNUSABLE", versionName: kmsTarget.versionName, state: "DISABLED" });
    expect(fingerprintService.take).not.toHaveBeenCalled();
    expect(dataKeyRepository.rewrapIfStillWrappedUnder).not.toHaveBeenCalled();
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("refuses when the key service cannot read the target version's state", async () => {
    const { service, fingerprintService, logger } = setup({ targetVersionError: rejectionWithStatus(grpc.status.NOT_FOUND) });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: false });

    expect(result.val).toMatchObject({ reason: `Target key version ${TARGET_KID} could not be read from the key service` });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "KEY_ROTATION_TARGET_VERSION_UNREADABLE" }));
    expect(fingerprintService.take).not.toHaveBeenCalled();
  });

  it("refuses when the key service rejects with something it cannot read a status from", async () => {
    const { service, fingerprintService } = setup({ targetVersionError: { code: grpc.status.UNIMPLEMENTED } });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: false });

    expect(result.val).toMatchObject({ reason: `Target key version ${TARGET_KID} could not be read from the key service` });
    expect(fingerprintService.take).not.toHaveBeenCalled();
  });

  it("carries on when the key service cannot answer the state at all, leaving the refusal to the key fetch", async () => {
    const { service, logger } = setup({ rows: [await storedKey()], targetVersionError: rejectionWithStatus(grpc.status.UNIMPLEMENTED) });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: false });

    expect(result.unwrap().usersReWrapped).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "KEY_ROTATION_TARGET_VERSION_STATE_UNAVAILABLE" }));
  });

  it("refuses when the target version publishes no usable key", async () => {
    const { service, fingerprintService, logger } = setup({ rows: [await storedKey()], sealingKeyUnavailable: true });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: false });

    expect(result.val).toMatchObject({ reason: `Target key version ${TARGET_KID} did not publish a usable key` });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "KEY_ROTATION_TARGET_KEY_UNAVAILABLE" }));
    expect(fingerprintService.take).not.toHaveBeenCalled();
  });

  it("re-wraps the same key bytes onto the target version, carrying every other claim", async () => {
    const dataKey = randomBytes(32);
    const stored = await storedKey(dataKey, { sub: "user-42" });
    const { service, writtenRows } = setup({ rows: [stored] });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: false });

    const rewrapped = writtenRows[0];
    expect(result.ok).toBe(true);
    expect(rewrapped.wrappedByKid).toBe(TARGET_KID);
    expect(rewrapped.wrappedUnder).toBe(PREVIOUS_KID);
    expect(rewrapped.wrappedKey).not.toBe(stored.wrappedKey);
    expect(decodeProtectedHeader(rewrapped.wrappedKey)).toEqual({ ...decodeProtectedHeader(stored.wrappedKey), kid: TARGET_KID });
    expect(await openUnderTarget(rewrapped.wrappedKey)).toEqual(dataKey);
  });

  it("spends one key-service unwrap per row and one public key fetch for the whole run", async () => {
    const rows = await Promise.all([storedKey(), storedKey(), storedKey()]);
    const { service, kmsClient, kmsTarget, fingerprintService, writtenRows } = setup({ rows });
    const startedAt = Date.now();

    const result = await service.rotate({ targetVersion: TARGET_VERSION, batchSize: 2, dryRun: false });

    const report = result.unwrap();
    expect(report).toMatchObject({ usersReWrapped: 3, fromVersions: { [PREVIOUS_KID]: 3 } });
    expect(report.bytesRewritten).toBe(writtenRows.reduce((total, row) => total + row.wrappedKey.length, 0));
    expect(report.elapsedMs).toBeLessThanOrEqual(Date.now() - startedAt);
    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(3);
    expect(kmsClient.getPublicKey).toHaveBeenCalledTimes(1);
    expect(kmsClient.getCryptoKeyVersion).toHaveBeenCalledWith({ name: kmsTarget.versionName }, expect.objectContaining({ timeout: expect.any(Number) }));
    expect(fingerprintService.take).toHaveBeenCalledWith({ batchSize: 2 });
    expect(fingerprintService.reconcile).toHaveBeenCalledWith(expect.anything(), { batchSize: 2 });
  });

  it("leaves a wrap naming a key version the console does not control untouched", async () => {
    const foreign = await storedKey(randomBytes(32), {}, "other-key.v1");
    const ours = await storedKey();
    const { service, kmsClient, writtenRows, logger } = setup({ rows: [foreign, ours] });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: false });

    expect(result.unwrap()).toMatchObject({ skippedForeignWrap: 1, usersReWrapped: 1 });
    expect(writtenRows.map(row => row.id)).toEqual([ours.id]);
    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith({ event: "KEY_ROTATION_FOREIGN_WRAP_SKIPPED", dataKeyId: foreign.id, wrappedByKid: "other-key.v1" });
  });

  it("steps over an unreadable wrapped key, moves its batch mates and fails the run", async () => {
    const corrupted = { ...(await storedKey()), wrappedKey: "not-a-jwe" };
    const { service, writtenRows, logger } = setup({ rows: [corrupted, await storedKey()] });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: false });

    expect(result.val).toMatchObject({ reason: "1 data keys could not be re-wrapped", report: { failed: 1, usersReWrapped: 1 } });
    expect(writtenRows.map(row => row.id)).not.toContain(corrupted.id);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "KEY_ROTATION_DATA_KEY_FAILED", dataKeyId: corrupted.id }));
  });

  it("states both refusals when a key could not be re-wrapped and a stored secret changed", async () => {
    const { service } = setup({ rows: [{ ...(await storedKey()), wrappedKey: "not-a-jwe" }], unexplained: ["deployment-setting-7"] });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: false });

    expect(result.val).toMatchObject({
      reason: "1 stored secrets changed with no write of their own behind them; 1 data keys could not be re-wrapped"
    });
  });

  it("counts what a run would move without opening or writing anything", async () => {
    const { service, kmsClient, writtenRows, txService } = setup({ rows: await Promise.all([storedKey(), storedKey()]) });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: true });

    expect(result.unwrap()).toMatchObject({ wouldReWrap: 2, usersReWrapped: 0, bytesRewritten: 0 });
    expect(writtenRows).toEqual([]);
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
    expect(txService.transaction).not.toHaveBeenCalled();
  });

  it("stops after a batch that could not be written, and reports it rolled back whole", async () => {
    const { service, logger, txService } = setup({ rows: await Promise.all([storedKey(), storedKey()]), writeFailsOnCall: 1 });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, batchSize: 1, dryRun: false });

    expect(result.val).toMatchObject({ reason: "A batch of data keys could not be written, and was rolled back whole" });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "KEY_ROTATION_BATCH_FAILED" }));
    expect(txService.transaction).toHaveBeenCalledTimes(1);
  });

  it("does not count a data key another writer moved onto the target first", async () => {
    const { service, logger } = setup({ rows: [await storedKey()], writeMovesNothing: true });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: false });

    expect(result.unwrap()).toMatchObject({ usersReWrapped: 0, bytesRewritten: 0, fromVersions: {} });
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "KEY_ROTATION_BATCH", reWrapped: 0 }));
  });

  it("fails the run and names the deployment when a stored secret changed with no write behind it", async () => {
    const { service, logger } = setup({ rows: [await storedKey()], unexplained: ["deployment-setting-7"] });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: false });

    expect(result.err).toBe(true);
    expect(result.val).toMatchObject({ report: { secretsReEncrypted: 1, usersReWrapped: 1 } });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "KEY_ROTATION_FINGERPRINT_MISMATCH", deploymentSettingIds: ["deployment-setting-7"] }));
  });

  it("tolerates a user rewriting their own secrets while the run is in flight", async () => {
    const { service } = setup({ rows: [await storedKey()], ownerRewritten: 1 });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, dryRun: false });

    expect(result.unwrap()).toMatchObject({ concurrentSecretWrites: 1, secretsReEncrypted: 0, usersReWrapped: 1 });
  });

  it("emits a start, both fingerprints, a batch event per batch and a completion carrying the report", async () => {
    const { service, logger } = setup({ rows: await Promise.all([storedKey(), storedKey(), storedKey()]) });

    const result = await service.rotate({ targetVersion: TARGET_VERSION, batchSize: 2, dryRun: false });

    expect((logger.info.mock.calls as Array<[{ event: string }]>).map(([payload]) => payload.event)).toEqual([
      "KEY_ROTATION_STARTED",
      "KEY_ROTATION_FINGERPRINT_TAKEN",
      "KEY_ROTATION_BATCH",
      "KEY_ROTATION_BATCH",
      "KEY_ROTATION_FINGERPRINT_TAKEN",
      "KEY_ROTATION_COMPLETED"
    ]);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "KEY_ROTATION_FINGERPRINT_TAKEN", phase: "before" }));
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "KEY_ROTATION_FINGERPRINT_TAKEN", phase: "after" }));
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "KEY_ROTATION_BATCH", rowCount: 2, reWrapped: 2 }));
    expect(logger.info).toHaveBeenCalledWith({ event: "KEY_ROTATION_COMPLETED", report: result.unwrap() });
    expect(logger.error).not.toHaveBeenCalled();
  });

  async function storedKey(dataKey = randomBytes(32), claims: Record<string, string> = {}, kid = PREVIOUS_KID): Promise<DataKeyOutput> {
    const wrappedKey = await new CompactEncrypt(dataKey)
      .setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM", ...claims, kid })
      .encrypt(keyPairOf(kid.endsWith(TARGET_VERSION) ? TARGET_VERSION : "1").publicKey);

    return { id: randomUUID(), userId: randomUUID(), wrappedKey, wrappedByKid: kid, createdAt: new Date(), updatedAt: new Date() };
  }

  function rejectionWithStatus(code: number) {
    return Object.assign(new Error("rejected by the key service"), { code });
  }

  async function openUnderTarget(wrappedKey: string) {
    const { plaintext } = await compactDecrypt(wrappedKey, keyPairs.get(TARGET_VERSION)!.privateKey);

    return Buffer.from(plaintext);
  }

  function setup(input?: {
    rows?: DataKeyOutput[];
    targetVersionState?: "DISABLED" | "DESTROYED";
    targetVersionError?: unknown;
    sealingKeyUnavailable?: boolean;
    writeFailsOnCall?: number;
    writeMovesNothing?: boolean;
    unexplained?: string[];
    ownerRewritten?: number;
  }) {
    const rows = input?.rows ?? [];
    const writtenRows: Array<{ id: string; wrappedKey: string; wrappedByKid: string; wrappedUnder: string }> = [];
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger: CreateLogger = (options = {}) => (options.context === DataKeyRotationService.name ? logger : mock<ReturnType<CreateLogger>>());
    const kmsClient = mock<SdlSecretsKmsClient>();

    kmsClient.getCryptoKeyVersion.mockImplementation(async ({ name }) => {
      if (input?.targetVersionError) throw input.targetVersionError;

      return [{ name, state: input?.targetVersionState ?? "ENABLED" }];
    });

    kmsClient.getPublicKey.mockImplementation(async ({ name }) => {
      if (input?.sealingKeyUnavailable) throw new Error("key service unreachable");

      const pem = keyPairOf(name).publicKey.export({ type: "spki", format: "pem" }).toString();

      return [{ name, pem, pemCrc32c: { value: String(crc32c.calculate(pem)) }, algorithm: "RSA_DECRYPT_OAEP_3072_SHA256" }];
    });

    kmsClient.asymmetricDecrypt.mockImplementation(async ({ name, ciphertext }) => {
      const plaintext = privateDecrypt({ key: keyPairOf(name).privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, ciphertext);

      return [
        { plaintext, plaintextCrc32c: { value: String(crc32c.calculate(plaintext)) }, verifiedCiphertextCrc32c: true } satisfies protos.google.cloud.kms.v1.IAsymmetricDecryptResponse
      ];
    });

    const kmsTarget = createTestSdlSecretsKmsTarget({ client: kmsClient, version: TARGET_VERSION });
    const dataKeyRepository = mock<DataKeyRepository>();

    dataKeyRepository.findNotWrappedUnderIteratively.mockImplementation(async function* ({ batchSize }) {
      const remaining = rows.filter(row => !writtenRows.some(written => written.id === row.id));

      for (let start = 0; start < remaining.length; start += batchSize) {
        yield remaining.slice(start, start + batchSize);
      }
    });
    let writes = 0;
    dataKeyRepository.rewrapIfStillWrappedUnder.mockImplementation(async rewrap => {
      writes += 1;

      if (writes === input?.writeFailsOnCall) throw new Error("connection lost");
      if (input?.writeMovesNothing) return false;

      writtenRows.push(rewrap);

      return true;
    });
    dataKeyRepository.countByWrappingVersion.mockResolvedValue({ [TARGET_KID]: rows.length });

    const fingerprintService = mock<StoredSecretFingerprintService>();
    const fingerprint = { digest: "d", rowCount: 0, byteTotal: 0 };
    fingerprintService.take.mockResolvedValue({ fingerprint, tokens: new Map(), takenAtMarker: "marker" });
    fingerprintService.reconcile.mockResolvedValue({
      before: fingerprint,
      after: fingerprint,
      ownerRewritten: input?.ownerRewritten ?? 0,
      created: 0,
      removed: 0,
      unexplained: input?.unexplained ?? []
    });

    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async run => await run());

    const service = new DataKeyRotationService(
      dataKeyRepository,
      fingerprintService,
      new KmsWrappedJweService(kmsTarget),
      new SdlSecretsSealingKeyService(kmsTarget, createLogger),
      txService,
      kmsTarget,
      createLogger
    );

    return { service, dataKeyRepository, fingerprintService, kmsClient, kmsTarget, txService, writtenRows, logger };
  }
});
