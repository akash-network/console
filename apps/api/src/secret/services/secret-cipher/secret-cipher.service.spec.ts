import { CompactEncrypt, decodeProtectedHeader } from "jose";
import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { DataKeyUnwrapperService } from "@src/secret/services/data-key-unwrapper/data-key-unwrapper.service";
import { SecretCipherService } from "./secret-cipher.service";

const DATA_KEY_ID = "2b0f1e3c-8a4d-4c22-9f10-7d5e6a1b2c3d";
const OTHER_DATA_KEY_ID = "9c8b7a65-4321-4def-8abc-0123456789ab";
const USER_ID = "3f2b6f7a-1c1d-4b0e-8b8a-9a0f5f5c2b11";
const DSEQ = "1420000";
const OTHER_DSEQ = "1420001";
const BINDING = { sub: USER_ID, dseq: DSEQ };

describe(SecretCipherService.name, () => {
  it("returns the value it was given after a round trip", async () => {
    const { service } = setup();
    const value = `postgres://app:${randomUUID()}@db.internal/app`;

    const encrypted = await service.encrypt(USER_ID, value, BINDING);

    await expect(service.decrypt(USER_ID, encrypted, BINDING)).resolves.toBe(value);
  });

  it("preserves a value carrying multibyte characters, newlines and quotes", async () => {
    const { service } = setup();
    const value = '-----BEGIN KEY-----\nдані\n"quoted"\t🔐\n-----END KEY-----\n';

    const encrypted = await service.encrypt(USER_ID, value, BINDING);

    await expect(service.decrypt(USER_ID, encrypted, BINDING)).resolves.toBe(value);
  });

  it("preserves an empty value", async () => {
    const { service } = setup();

    const encrypted = await service.encrypt(USER_ID, "", BINDING);

    await expect(service.decrypt(USER_ID, encrypted, BINDING)).resolves.toBe("");
  });

  it("records the data key record that encrypted the value", async () => {
    const { service } = setup();

    const encrypted = await service.encrypt(USER_ID, "value", BINDING);

    expect(decodeProtectedHeader(encrypted).kid).toBe(DATA_KEY_ID);
  });

  it("declares the key management and content encryption it uses", async () => {
    const { service } = setup();

    const encrypted = await service.encrypt(USER_ID, "value", BINDING);

    expect(decodeProtectedHeader(encrypted)).toMatchObject({ alg: "dir", enc: "A256GCM" });
  });

  it("records what it was bound to and nothing else", async () => {
    const { service } = setup();

    const encrypted = await service.encrypt(USER_ID, "value", BINDING);

    expect(Object.keys(decodeProtectedHeader(encrypted))).toEqual(["sub", "dseq", "alg", "enc", "kid"]);
  });

  it("encrypts the same value differently every time", async () => {
    const { service } = setup();

    const [first, second] = await Promise.all([service.encrypt(USER_ID, "value", BINDING), service.encrypt(USER_ID, "value", BINDING)]);

    expect(first).not.toBe(second);
  });

  it("rejects a value recorded against a different data key record", async () => {
    const { service, key } = setup();
    const encryptedForAnotherRecord = await setup({ dataKeyId: OTHER_DATA_KEY_ID, key }).service.encrypt(USER_ID, "value", BINDING);

    await expect(service.decrypt(USER_ID, encryptedForAnotherRecord, BINDING)).rejects.toMatchObject({ status: 500 });
  });

  it("spends no unwrap on a value recorded against a different data key record", async () => {
    const { service, unwrap, key } = setup();
    const encryptedForAnotherRecord = await setup({ dataKeyId: OTHER_DATA_KEY_ID, key }).service.encrypt(USER_ID, "value", BINDING);

    await expect(service.decrypt(USER_ID, encryptedForAnotherRecord, BINDING)).rejects.toThrow();

    expect(unwrap).not.toHaveBeenCalled();
  });

  it("rejects a value encrypted under a different key even when it names the same record", async () => {
    const { service } = setup();
    const encryptedUnderAnotherKey = await setup({ key: randomBytes(32) }).service.encrypt(USER_ID, "value", BINDING);

    await expect(service.decrypt(USER_ID, encryptedUnderAnotherKey, BINDING)).rejects.toMatchObject({ status: 500 });
  });

  it("rejects a value whose ciphertext was altered", async () => {
    const { service } = setup();
    const parts = (await service.encrypt(USER_ID, "value", BINDING)).split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");

    await expect(service.decrypt(USER_ID, parts.join("."), BINDING)).rejects.toMatchObject({ status: 500 });
  });

  it("rejects a value whose recorded data key was rewritten in place", async () => {
    const { service } = setup();
    const [, ...rest] = (await service.encrypt(USER_ID, "value", BINDING)).split(".");
    const forged = Buffer.from(JSON.stringify({ ...BINDING, alg: "dir", enc: "A256GCM", kid: OTHER_DATA_KEY_ID })).toString("base64url");

    await expect(service.decrypt(USER_ID, [forged, ...rest].join("."), BINDING)).rejects.toMatchObject({ status: 500 });
  });

  it("rejects a value carrying a bound claim the reader never named", async () => {
    const { service, logger } = setup();
    const [, ...rest] = (await service.encrypt(USER_ID, "value", BINDING)).split(".");
    const forged = Buffer.from(JSON.stringify({ ...BINDING, alg: "dir", enc: "A256GCM", kid: DATA_KEY_ID, tampered: "true" })).toString("base64url");

    await expect(service.decrypt(USER_ID, [forged, ...rest].join("."), BINDING)).rejects.toMatchObject({ status: 500 });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "SECRET_VALUE_BINDING_UNACCOUNTED" }));
  });

  it("refuses a reader that names only some of what the value was bound to", async () => {
    const { service, unwrap, logger } = setup();
    const encrypted = await service.encrypt(USER_ID, "value", BINDING);
    unwrap.mockClear();

    await expect(service.decrypt(USER_ID, encrypted, { sub: USER_ID })).rejects.toMatchObject({ status: 500 });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "SECRET_VALUE_BINDING_UNACCOUNTED", bound: ["sub", "dseq"], named: ["sub"] }));
    expect(unwrap).not.toHaveBeenCalled();
  });

  it("refuses a reader that names nothing for a value that was bound to something", async () => {
    const { service } = setup();
    const encrypted = await service.encrypt(USER_ID, "value", BINDING);

    await expect(service.decrypt(USER_ID, encrypted, {})).rejects.toMatchObject({ status: 500 });
  });

  it("rejects a value declaring a key management algorithm it does not use", async () => {
    const { service, key } = setup();
    const wrapped = await new CompactEncrypt(new TextEncoder().encode("value"))
      .setProtectedHeader({ ...BINDING, alg: "A256GCMKW", enc: "A256GCM", kid: DATA_KEY_ID })
      .encrypt(key);

    await expect(service.decrypt(USER_ID, wrapped, BINDING)).rejects.toMatchObject({ status: 500 });
  });

  it("rejects a value declaring a content encryption it does not use", async () => {
    const { service, key } = setup();
    const wrapped = await new CompactEncrypt(new TextEncoder().encode("value"))
      .setProtectedHeader({ ...BINDING, alg: "dir", enc: "A128CBC-HS256", kid: DATA_KEY_ID })
      .encrypt(key);

    await expect(service.decrypt(USER_ID, wrapped, BINDING)).rejects.toMatchObject({ status: 500 });
  });

  it("spends no unwrap on a value declaring a key management algorithm it does not use", async () => {
    const { service, unwrap, key, logger } = setup();
    const wrapped = await new CompactEncrypt(new TextEncoder().encode("value"))
      .setProtectedHeader({ ...BINDING, alg: "A256GCMKW", enc: "A256GCM", kid: DATA_KEY_ID })
      .encrypt(key);

    await expect(service.decrypt(USER_ID, wrapped, BINDING)).rejects.toThrow();

    expect(unwrap).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "SECRET_VALUE_ALGORITHM_UNSUPPORTED" }));
  });

  it("spends no unwrap on a value declaring a content encryption it does not use", async () => {
    const { service, unwrap, key } = setup();
    const wrapped = await new CompactEncrypt(new TextEncoder().encode("value"))
      .setProtectedHeader({ ...BINDING, alg: "dir", enc: "A128CBC-HS256", kid: DATA_KEY_ID })
      .encrypt(key);

    await expect(service.decrypt(USER_ID, wrapped, BINDING)).rejects.toThrow();

    expect(unwrap).not.toHaveBeenCalled();
  });

  it("rejects a value that is not a compact JWE", async () => {
    const { service, logger } = setup();

    await expect(service.decrypt(USER_ID, "not-a-jwe", BINDING)).rejects.toMatchObject({ status: 500 });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "SECRET_VALUE_HEADER_UNREADABLE" }));
  });

  it("refuses a value bound to another deployment of the same owner", async () => {
    const { service } = setup();

    const encrypted = await service.encrypt(USER_ID, "value", BINDING);

    await expect(service.decrypt(USER_ID, encrypted, { sub: USER_ID, dseq: OTHER_DSEQ })).rejects.toMatchObject({ status: 500 });
  });

  it("spends no unwrap on a value bound to another deployment of the same owner", async () => {
    const { service, unwrap, logger } = setup();
    const encrypted = await service.encrypt(USER_ID, "value", BINDING);
    unwrap.mockClear();

    await expect(service.decrypt(USER_ID, encrypted, { sub: USER_ID, dseq: OTHER_DSEQ })).rejects.toThrow();

    expect(unwrap).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "SECRET_VALUE_BINDING_MISMATCH", claim: "dseq" }));
  });

  it("refuses a value bound to another owner", async () => {
    const { service } = setup();

    const encrypted = await service.encrypt(USER_ID, "value", BINDING);

    await expect(service.decrypt(USER_ID, encrypted, { sub: OTHER_DATA_KEY_ID, dseq: DSEQ })).rejects.toMatchObject({ status: 500 });
  });

  it("refuses a value bound to a claim the reader asks about and the value never carried", async () => {
    const { service } = setup();

    const encrypted = await service.encrypt(USER_ID, "value", { sub: USER_ID });

    await expect(service.decrypt(USER_ID, encrypted, BINDING)).rejects.toMatchObject({ status: 500 });
  });

  it("fails the authentication tag rather than the claim check when a bound claim is rewritten in place", async () => {
    const { service } = setup();
    const [, ...rest] = (await service.encrypt(USER_ID, "value", BINDING)).split(".");
    const rebound = { sub: USER_ID, dseq: OTHER_DSEQ, alg: "dir", enc: "A256GCM", kid: DATA_KEY_ID };
    const forged = Buffer.from(JSON.stringify(rebound)).toString("base64url");

    await expect(service.decrypt(USER_ID, [forged, ...rest].join("."), { sub: USER_ID, dseq: OTHER_DSEQ })).rejects.toMatchObject({ status: 500 });
  });

  it("keeps the claims describing its own encryption when a binding names them", async () => {
    const { service } = setup();

    const encrypted = await service.encrypt(USER_ID, "value", { alg: "none", enc: "none", kid: OTHER_DATA_KEY_ID });

    expect(decodeProtectedHeader(encrypted)).toMatchObject({ alg: "dir", enc: "A256GCM", kid: DATA_KEY_ID });
  });

  it("binds nothing beyond its own encryption when the binding is empty", async () => {
    const { service } = setup();

    const encrypted = await service.encrypt(USER_ID, "value", {});

    expect(Object.keys(decodeProtectedHeader(encrypted))).toEqual(["alg", "enc", "kid"]);
    await expect(service.decrypt(USER_ID, encrypted, {})).resolves.toBe("value");
  });

  it("asks for the owner's data key rather than a key of its own", async () => {
    const { service, dataKeyUnwrapperService } = setup();

    await service.encrypt(USER_ID, "value", BINDING);

    expect(dataKeyUnwrapperService.getDataKey).toHaveBeenCalledWith(USER_ID);
  });

  function setup(input?: { dataKeyId?: string; key?: Buffer }) {
    const key = input?.key ?? randomBytes(32);
    const unwrap = vi.fn(async () => key);
    const dataKeyUnwrapperService = mock<DataKeyUnwrapperService>();
    dataKeyUnwrapperService.getDataKey.mockResolvedValue({ id: input?.dataKeyId ?? DATA_KEY_ID, unwrap });
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new SecretCipherService(dataKeyUnwrapperService, () => logger);

    return { service, dataKeyUnwrapperService, unwrap, key, logger };
  }
});
