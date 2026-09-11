import type { protos } from "@google-cloud/kms";
import type { Histogram, Meter } from "@opentelemetry/api";
import crc32c from "fast-crc32c";
import { grpc } from "google-gax";
import { CompactEncrypt } from "jose";
import { constants, generateKeyPairSync, privateDecrypt, randomBytes } from "node:crypto";
import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { MetricsService } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { SdlSecretsKmsClient } from "@src/deployment/providers/kms.provider";
import { KmsWrappedJweService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import type { KmsWrappedJweInstrumentationService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe-instrumentation.service";
import { SECRET_UNREADABLE_ERROR_MESSAGE } from "@src/secret/config/secret-at-rest.config";
import type { DataKeyOutput } from "@src/secret/repositories/data-key/data-key.repository";
import type { DataKeyService } from "@src/secret/services/data-key/data-key.service";
import { DataKeyUnwrapInstrumentationService } from "./data-key-unwrap-instrumentation.service";
import { DataKeyUnwrapperService } from "./data-key-unwrapper.service";

import { createDataKey } from "@test/seeders/data-key.seeder";

const KID = "sdl-secrets.v1";
const VERSION_NAME = "projects/console-test/locations/global/keyRings/console-api/cryptoKeys/sdl-secrets/cryptoKeyVersions/1";
const USER_A = "3f2b6f7a-1c1d-4b0e-8b8a-9a0f5f5c2b11";
const USER_B = "6d0b1f4c-2222-4444-8888-1a2b3c4d5e6f";

const WRAPPING_KEY_PAIR = generateKeyPairSync("rsa", { modulusLength: 3072 });

const dropAuthenticationTagSegment = (wrappedKey: string) => wrappedKey.split(".").slice(0, -1).join(".");

const tamperAuthenticationTag = (wrappedKey: string) => {
  const parts = wrappedKey.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");

  return parts.join(".");
};

const FAILING_UNWRAPS = [
  { path: "the row is wrapped under a key version this process does not target", input: { kid: "sdl-secrets.v9" } },
  { path: "the key service is unreachable", input: { keyServiceStatus: grpc.status.UNAVAILABLE } },
  { path: "the key service rejects the encrypted key", input: { keyServiceStatus: grpc.status.INVALID_ARGUMENT } },
  { path: "the wrapped key is missing a segment", input: { mutateWrappedKey: dropAuthenticationTagSegment } },
  { path: "the wrapped key fails authentication", input: { mutateWrappedKey: tamperAuthenticationTag } },
  { path: "the row wraps something other than 256 bits", input: { keyBytes: 16 } }
];

describe(DataKeyUnwrapperService.name, () => {
  it("returns the key the user's data key row wraps", async () => {
    const { service, inRequest, keyFor } = setup();

    const key = await inRequest(async () => await (await service.getDataKey(USER_A)).unwrap());

    expect(key.equals(keyFor(USER_A))).toBe(true);
  });

  it("returns the record the key belongs to", async () => {
    const { service, inRequest, rowFor } = setup();

    const dataKey = await inRequest(async () => await service.getDataKey(USER_A));

    expect(dataKey.id).toBe(rowFor(USER_A).id);
  });

  it("records the user, the data key and the wrapping key version when it unwraps", async () => {
    const { service, inRequest, logger, rowFor } = setup();

    await inRequest(async () => await (await service.getDataKey(USER_A)).unwrap());

    expect(logger.info).toHaveBeenCalledExactlyOnceWith({ event: "USER_DATA_KEY_UNWRAPPED", userId: USER_A, dataKeyId: rowFor(USER_A).id, kid: KID });
  });

  it("spends no key service call for the record identity alone", async () => {
    const { service, inRequest, kmsClient } = setup();

    await inRequest(async () => await service.getDataKey(USER_A));

    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("unwraps once for two unwraps in the same request", async () => {
    const { service, inRequest, kmsClient } = setup();

    await inRequest(async () => {
      await (await service.getDataKey(USER_A)).unwrap();
      await (await service.getDataKey(USER_A)).unwrap();
    });

    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(1);
  });

  it("unwraps once for twelve concurrent unwraps in the same request", async () => {
    const { service, inRequest, kmsClient } = setup();

    await inRequest(async () => await Promise.all(Array.from({ length: 12 }, async () => await (await service.getDataKey(USER_A)).unwrap())));

    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(1);
  });

  it("reads the data key row once per user per request", async () => {
    const { service, inRequest, dataKeyService } = setup();

    await inRequest(async () => await Promise.all([service.getDataKey(USER_A), service.getDataKey(USER_A), service.getDataKey(USER_A)]));

    expect(dataKeyService.ensureDataKey).toHaveBeenCalledTimes(1);
  });

  it("unwraps again in the request that follows the one that unwrapped it", async () => {
    const { service, inRequest, kmsClient } = setup();

    await inRequest(async () => await (await service.getDataKey(USER_A)).unwrap());
    await inRequest(async () => await (await service.getDataKey(USER_A)).unwrap());

    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(2);
  });

  it("unwraps once per user when one request needs two users' keys", async () => {
    const { service, inRequest, kmsClient } = setup();

    await inRequest(async () => {
      await (await service.getDataKey(USER_A)).unwrap();
      await (await service.getDataKey(USER_B)).unwrap();
    });

    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(2);
  });

  it("never serves one user's key for another user in the same request", async () => {
    const { service, inRequest, keyFor } = setup();

    const [keyOfA, keyOfB] = await inRequest(
      async () => await Promise.all([(await service.getDataKey(USER_A)).unwrap(), (await service.getDataKey(USER_B)).unwrap()])
    );

    expect(keyOfA.equals(keyFor(USER_A))).toBe(true);
    expect(keyOfB.equals(keyFor(USER_B))).toBe(true);
    expect(keyOfA.equals(keyOfB)).toBe(false);
  });

  it("names each user a request unwrapped for", async () => {
    const { service, inRequest, unwrappedUserIds } = setup();

    await inRequest(async () => {
      await (await service.getDataKey(USER_A)).unwrap();
      await (await service.getDataKey(USER_B)).unwrap();
    });

    expect(new Set(unwrappedUserIds())).toEqual(new Set([USER_A, USER_B]));
  });

  it("holds nothing for a request that has not asked for a data key", async () => {
    const { inRequest, executionContextService } = setup();

    const held = await inRequest(async () => executionContextService.get("HELD_DATA_KEYS"));

    expect(held).toBeUndefined();
  });

  it("holds no data key once the request that held one has ended", async () => {
    const { service, inRequest, executionContextService } = setup();

    const heldDuringRequest = await inRequest(async () => {
      await (await service.getDataKey(USER_A)).unwrap();

      return executionContextService.get("HELD_DATA_KEYS");
    });
    const heldInNextRequest = await inRequest(async () => executionContextService.get("HELD_DATA_KEYS"));

    expect(heldDuringRequest?.size).toBe(1);
    expect(heldInNextRequest).toBeUndefined();
  });

  it("refuses to hand out a data key outside any request at all", async () => {
    const { service, kmsClient, logger } = setup();

    await expect(service.getDataKey(USER_A)).rejects.toMatchObject({ status: 500, message: SECRET_UNREADABLE_ERROR_MESSAGE });

    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "USER_DATA_KEY_OUTSIDE_REQUEST" }));
  });

  it("forgets the key it refused, so returning to the holding request unwraps afresh", async () => {
    const { service, inRequest, kmsClient } = setup();

    await inRequest(async () => {
      const dataKey = await service.getDataKey(USER_A);
      await dataKey.unwrap();

      await inRequest(async () => await expect(dataKey.unwrap()).rejects.toMatchObject({ status: 500 }));

      await dataKey.unwrap();
    });

    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(2);
  });

  it("refuses to unwrap once the request that held the data key has ended", async () => {
    const { service, inRequest, kmsClient } = setup();

    const escaped = await inRequest(async () => await service.getDataKey(USER_A));

    await expect(escaped.unwrap()).rejects.toMatchObject({ status: 500, message: SECRET_UNREADABLE_ERROR_MESSAGE });
    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("refuses to unwrap again once the request that already unwrapped it has ended", async () => {
    const { service, inRequest, kmsClient } = setup();

    const escaped = await inRequest(async () => {
      const dataKey = await service.getDataKey(USER_A);
      await dataKey.unwrap();

      return dataKey;
    });

    await expect(escaped.unwrap()).rejects.toMatchObject({ status: 500 });
    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(1);
  });

  it("refuses to serve one request's data key into another request", async () => {
    const { service, inRequest, kmsClient, logger } = setup();

    const escaped = await inRequest(async () => await service.getDataKey(USER_A));

    await inRequest(async () => await expect(escaped.unwrap()).rejects.toMatchObject({ status: 500 }));

    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "USER_DATA_KEY_ESCAPED_REQUEST" }));
  });

  it("refuses to serve a data key into a request that holds one of its own", async () => {
    const { service, inRequest, kmsClient } = setup();

    const escaped = await inRequest(async () => await service.getDataKey(USER_A));

    await inRequest(async () => {
      await (await service.getDataKey(USER_A)).unwrap();
      await expect(escaped.unwrap()).rejects.toMatchObject({ status: 500 });
    });

    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(1);
  });

  it("unwraps again after a failed unwrap in the same request", async () => {
    const { service, inRequest, kmsClient } = setup();
    kmsClient.asymmetricDecrypt.mockRejectedValueOnce(Object.assign(new Error("14 UNAVAILABLE"), { code: grpc.status.UNAVAILABLE }));

    const key = await inRequest(async () => {
      const dataKey = await service.getDataKey(USER_A);
      await expect(dataKey.unwrap()).rejects.toMatchObject({ status: 503 });

      return await dataKey.unwrap();
    });

    expect(key).toHaveLength(32);
    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(2);
  });

  it("rejects with 503 when the row is wrapped under a key version this process does not target", async () => {
    const { service, inRequest, kmsClient } = setup({ kid: "sdl-secrets.v9" });

    await inRequest(async () => await expect((await service.getDataKey(USER_A)).unwrap()).rejects.toMatchObject({ status: 503 }));

    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("rejects with 503 when the key service is unreachable", async () => {
    const { service, inRequest, logger } = setup({ keyServiceStatus: grpc.status.UNAVAILABLE });

    await inRequest(async () => await expect((await service.getDataKey(USER_A)).unwrap()).rejects.toMatchObject({ status: 503 }));

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "USER_DATA_KEY_UNWRAP_FAILED", failure: "KEY_SERVICE_UNREACHABLE", userId: USER_A })
    );
  });

  it("blames itself rather than a caller when the key service rejects the encrypted key", async () => {
    const { service, inRequest, logger } = setup({ keyServiceStatus: grpc.status.INVALID_ARGUMENT });

    await inRequest(async () => await expect((await service.getDataKey(USER_A)).unwrap()).rejects.toMatchObject({ status: 500 }));

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "USER_DATA_KEY_UNREADABLE", failure: "ENCRYPTED_KEY_REJECTED", userId: USER_A })
    );
  });

  it("rejects with 500 when the wrapped key is not a compact JWE", async () => {
    const { service, inRequest } = setup({ mutateWrappedKey: () => "not.a.jwe" });

    await inRequest(async () => await expect((await service.getDataKey(USER_A)).unwrap()).rejects.toMatchObject({ status: 500 }));
  });

  it("rejects with 500 when the wrapped key fails authentication", async () => {
    const { service, inRequest } = setup({ mutateWrappedKey: tamperAuthenticationTag });

    await inRequest(async () => await expect((await service.getDataKey(USER_A)).unwrap()).rejects.toMatchObject({ status: 500 }));
  });

  it("rejects with 500 when the row wraps something other than 256 bits", async () => {
    const { service, inRequest, logger } = setup({ keyBytes: 16 });

    await inRequest(async () => await expect((await service.getDataKey(USER_A)).unwrap()).rejects.toMatchObject({ status: 500 }));

    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "USER_DATA_KEY_LENGTH_UNEXPECTED", keyBytes: 16 }));
  });

  it("propagates a data key that could not be read at all", async () => {
    const { service, inRequest, dataKeyService } = setup();
    dataKeyService.ensureDataKey.mockRejectedValue(new Error("no row"));

    await inRequest(async () => await expect(service.getDataKey(USER_A)).rejects.toThrow("no row"));
  });

  it("measures one unwrap for a request that unwrapped one user's key twice", async () => {
    const { service, inRequest, unwrapsPerRequest } = setup();

    await inRequest(async () => {
      await (await service.getDataKey(USER_A)).unwrap();
      await (await service.getDataKey(USER_A)).unwrap();
    });

    expect(unwrapsPerRequest.record).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("measures one unwrap for each user a request unwrapped for", async () => {
    const { service, inRequest, unwrapsPerRequest } = setup();

    await inRequest(async () => {
      await (await service.getDataKey(USER_A)).unwrap();
      await (await service.getDataKey(USER_B)).unwrap();
    });

    expect(unwrapsPerRequest.record.mock.calls).toEqual([[1], [1]]);
  });

  it("measures no unwrap for a request that asked only for the record", async () => {
    const { service, inRequest, unwrapsPerRequest } = setup();

    await inRequest(async () => await service.getDataKey(USER_A));

    expect(unwrapsPerRequest.record).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("measures no unwrap for a user whose unwrap failed", async () => {
    const { service, inRequest, unwrapsPerRequest } = setup({ keyServiceStatus: grpc.status.UNAVAILABLE });

    await inRequest(async () => await expect((await service.getDataKey(USER_A)).unwrap()).rejects.toThrow());

    expect(unwrapsPerRequest.record).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("measures nothing for a request that never asked for a data key", async () => {
    const { inRequest, unwrapsPerRequest } = setup();

    await inRequest(async () => undefined);

    expect(unwrapsPerRequest.record).not.toHaveBeenCalled();
  });

  it("keeps the measurements of two concurrent requests apart", async () => {
    const { service, inRequest, unwrapsPerRequest } = setup();

    await Promise.all([
      inRequest(async () => await (await service.getDataKey(USER_A)).unwrap()),
      inRequest(async () => await (await service.getDataKey(USER_B)).unwrap())
    ]);

    expect(unwrapsPerRequest.record.mock.calls).toEqual([[1], [1]]);
  });

  it("logs no key material when it unwraps", async () => {
    const { service, inRequest, expectNoKeyMaterialLogged } = setup();

    await inRequest(async () => await (await service.getDataKey(USER_A)).unwrap());

    expectNoKeyMaterialLogged();
  });

  it.each(FAILING_UNWRAPS)("logs no key material when $path", async ({ input }) => {
    const { service, inRequest, expectNoKeyMaterialLogged } = setup(input);

    await inRequest(async () => await expect((await service.getDataKey(USER_A)).unwrap()).rejects.toThrow());

    expectNoKeyMaterialLogged();
  });

  function setup(input?: { kid?: string; keyBytes?: number; keyServiceStatus?: grpc.status; mutateWrappedKey?: (wrappedKey: string) => string }) {
    const { publicKey, privateKey } = WRAPPING_KEY_PAIR;
    const wrappedKid = input?.kid ?? KID;
    const keys = new Map<string, Buffer>();
    const wrappedJwes = new Map<string, string>();
    const rows = new Map<string, DataKeyOutput>();

    const dataKeyService = mock<DataKeyService>();
    dataKeyService.ensureDataKey.mockImplementation(async userId => {
      const existing = rows.get(userId);

      if (existing) return existing;

      const key = randomBytes(input?.keyBytes ?? 32);
      const wrapped = await new CompactEncrypt(key).setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM", kid: wrappedKid }).encrypt(publicKey);
      const row = createDataKey({ userId, wrappedKey: input?.mutateWrappedKey?.(wrapped) ?? wrapped, wrappedByKid: wrappedKid });

      keys.set(userId, key);
      wrappedJwes.set(userId, wrapped);
      rows.set(userId, row);

      return row;
    });

    const kmsClient = mock<SdlSecretsKmsClient>();
    kmsClient.asymmetricDecrypt.mockImplementation(async request => {
      if (input?.keyServiceStatus !== undefined) {
        throw Object.assign(new Error(`key service refused with ${input.keyServiceStatus}`), { code: input.keyServiceStatus });
      }

      const plaintext = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(request.ciphertext));

      return [
        {
          plaintext,
          plaintextCrc32c: { value: String(crc32c.calculate(plaintext)) },
          verifiedCiphertextCrc32c: true
        } satisfies protos.google.cloud.kms.v1.IAsymmetricDecryptResponse
      ];
    });

    const kmsTarget = { client: kmsClient, versionName: VERSION_NAME, kid: KID };
    const logger = mock<ReturnType<CreateLogger>>();
    const executionContextService = new ExecutionContextService(() => logger);

    const unwrapsPerRequest = mock<Histogram>();
    const metricsService = mock<MetricsService>();
    metricsService.getMeter.mockReturnValue(mock<Meter>());
    metricsService.createHistogram.mockReturnValue(unwrapsPerRequest);

    const service = new DataKeyUnwrapperService(
      dataKeyService,
      executionContextService,
      new KmsWrappedJweService(kmsTarget, mock<KmsWrappedJweInstrumentationService>()),
      new DataKeyUnwrapInstrumentationService(metricsService, executionContextService),
      kmsTarget,
      () => logger
    );

    const inRequest = <R>(cb: () => Promise<R>) => executionContextService.runWithContext(cb);
    const keyFor = (userId: string) => keys.get(userId) as Buffer;
    const rowFor = (userId: string) => rows.get(userId) as DataKeyOutput;

    const unwrappedUserIds = () => {
      const records = logger.info.mock.calls.flat() as Array<Record<string, unknown>>;

      return records.filter(record => record.event === "USER_DATA_KEY_UNWRAPPED").map(record => record.userId);
    };

    const expectNoKeyMaterialLogged = () => {
      const key = keyFor(USER_A);
      const wrappedJwe = wrappedJwes.get(USER_A) as string;
      const records = inspect([...logger.info.mock.calls, ...logger.error.mock.calls], { depth: null, maxArrayLength: null, maxStringLength: null });
      const neverLoggable = [
        key.toString("hex"),
        key.toString("base64"),
        key.toString("base64url"),
        key.toString("latin1"),
        inspect(key),
        wrappedJwe,
        wrappedJwe.split(".")[1],
        rowFor(USER_A).wrappedKey
      ];

      expect(logger.info.mock.calls.length + logger.error.mock.calls.length).toBeGreaterThan(0);

      for (const secret of neverLoggable) {
        expect(records).not.toContain(secret);
      }
    };

    return {
      service,
      dataKeyService,
      kmsClient,
      executionContextService,
      logger,
      unwrapsPerRequest,
      inRequest,
      keyFor,
      rowFor,
      unwrappedUserIds,
      expectNoKeyMaterialLogged
    };
  }
});
