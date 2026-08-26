import type { protos } from "@google-cloud/kms";
import crc32c from "fast-crc32c";
import { grpc } from "google-gax";
import createError from "http-errors";
import { CompactEncrypt } from "jose";
import { constants, generateKeyPairSync, privateDecrypt, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlSecretsKmsClient } from "@src/deployment/providers/kms.provider";
import { KmsWrappedJweError, KmsWrappedJweService } from "./kms-wrapped-jwe.service";

const KID = "sdl-secrets.v1";
const VERSION_NAME = "projects/console-test/locations/global/keyRings/console-api/cryptoKeys/sdl-secrets/cryptoKeyVersions/1";

async function expectFailure(open: Promise<unknown>, failure: string) {
  await expect(open).rejects.toMatchObject({ failure });
}

function parseFailure(service: KmsWrappedJweService, serialized: string) {
  try {
    service.parse(serialized);
  } catch (error) {
    return error;
  }

  return undefined;
}

describe(KmsWrappedJweService.name, () => {
  it("returns the exact bytes the wrapped content encryption key protects", async () => {
    const { service, wrap } = setup();
    const payload = randomBytes(32);

    const plaintext = await service.open(service.parse(await wrap(payload)));

    expect(plaintext.equals(payload)).toBe(true);
  });

  it("returns a payload that is not JSON, because what the bytes mean belongs to the caller", async () => {
    const { service, wrap } = setup();

    const plaintext = await service.open(service.parse(await wrap(Buffer.from([0, 1, 255]))));

    expect([...plaintext]).toEqual([0, 1, 255]);
  });

  it("parses a header carrying nothing but the algorithm claims, so a wrapped data key is not held to a transport seal's claims", async () => {
    const { service, wrap } = setup();

    const { header } = service.parse(await wrap(randomBytes(32)));

    expect(header).toEqual({ alg: "RSA-OAEP-256", enc: "A256GCM", kid: KID });
  });

  it("returns header claims it does not itself validate", async () => {
    const { service, wrap } = setup();

    const { header } = service.parse(await wrap(randomBytes(32), { sub: "someone", exp: 1 }));

    expect(header).toMatchObject({ sub: "someone", exp: 1 });
  });

  it("spends no key service call while parsing", async () => {
    const { service, wrap, kmsClient } = setup();

    service.parse(await wrap(randomBytes(32)));

    expect(kmsClient.asymmetricDecrypt).not.toHaveBeenCalled();
  });

  it("unwraps the content encryption key with the configured crypto key version", async () => {
    const { service, wrap, kmsClient } = setup();

    await service.open(service.parse(await wrap(randomBytes(32))));

    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledWith(expect.objectContaining({ name: VERSION_NAME }));
  });

  it("spends one key service call per open", async () => {
    const { service, wrap, kmsClient } = setup();
    const parsed = service.parse(await wrap(randomBytes(32)));

    await service.open(parsed);

    expect(kmsClient.asymmetricDecrypt).toHaveBeenCalledTimes(1);
  });

  it("reports what failed without deciding whose fault it is", async () => {
    const { service } = setup();

    expect(parseFailure(service, "not.a.jwe")).toBeInstanceOf(KmsWrappedJweError);
    expect(createError.isHttpError(parseFailure(service, "not.a.jwe"))).toBe(false);
  });

  it("reports anything that is not a compact serialization as malformed", async () => {
    const { service } = setup();

    expect(parseFailure(service, "not.a.jwe")).toMatchObject({ failure: "MALFORMED" });
  });

  it("reports a protected header that is not base64url as unreadable", async () => {
    const { service, wrap } = setup();
    const parts = (await wrap(randomBytes(32))).split(".");
    parts[0] = `${parts[0]}!`;

    expect(parseFailure(service, parts.join("."))).toMatchObject({ failure: "HEADER_UNREADABLE" });
  });

  it("reports a protected header that is not a JSON object as unreadable", async () => {
    const { service, wrap } = setup();
    const [, ...rest] = (await wrap(randomBytes(32))).split(".");

    expect(parseFailure(service, [Buffer.from("[]").toString("base64url"), ...rest].join("."))).toMatchObject({ failure: "HEADER_UNREADABLE" });
  });

  it("reports an encrypted key that is not the length a modulus fixes as invalid", async () => {
    const { service, wrap } = setup();
    const parts = (await wrap(randomBytes(32))).split(".");
    parts[1] = randomBytes(200).toString("base64url");

    expect(parseFailure(service, parts.join("."))).toMatchObject({ failure: "ENCRYPTED_KEY_INVALID" });
  });

  it("reports a ciphertext that is not base64url as invalid", async () => {
    const { service, wrap } = setup();
    const parts = (await wrap(randomBytes(32))).split(".");
    parts[3] = `${parts[3]}!!!!`;

    expect(parseFailure(service, parts.join("."))).toMatchObject({ failure: "CIPHERTEXT_INVALID" });
  });

  it("reports an initialization vector that is not the 96 bits A256GCM fixes as invalid", async () => {
    const { service, wrap } = setup();
    const parts = (await wrap(randomBytes(32))).split(".");
    parts[2] = randomBytes(13).toString("base64url");

    expect(parseFailure(service, parts.join("."))).toMatchObject({ failure: "IV_INVALID" });
  });

  it("reports an authentication tag that is not the 128 bits A256GCM fixes as invalid", async () => {
    const { service, wrap } = setup();
    const parts = (await wrap(randomBytes(32))).split(".");
    parts[4] = Buffer.alloc(5).toString("base64url");

    expect(parseFailure(service, parts.join("."))).toMatchObject({ failure: "TAG_INVALID" });
  });

  it("reports a key service that rejects the encrypted key separately from one that is unreachable", async () => {
    const { service, wrap, kmsClient } = setup();
    kmsClient.asymmetricDecrypt.mockRejectedValue(Object.assign(new Error("3 INVALID_ARGUMENT"), { code: grpc.status.INVALID_ARGUMENT }));

    await expectFailure(service.open(service.parse(await wrap(randomBytes(32)))), "ENCRYPTED_KEY_REJECTED");
  });

  it("reports an unreachable key service and carries the underlying error for the caller to log", async () => {
    const { service, wrap, kmsClient } = setup();
    const unreachable = Object.assign(new Error("14 UNAVAILABLE"), { code: grpc.status.UNAVAILABLE });
    kmsClient.asymmetricDecrypt.mockRejectedValue(unreachable);

    await expect(service.open(service.parse(await wrap(randomBytes(32))))).rejects.toMatchObject({
      failure: "KEY_SERVICE_UNREACHABLE",
      details: { versionName: VERSION_NAME, error: unreachable }
    });
  });

  it("reports a key service that could not verify the request checksum", async () => {
    const { service, wrap, kmsClient } = setup();
    kmsClient.asymmetricDecrypt.mockResolvedValue([{ plaintext: Buffer.alloc(32), verifiedCiphertextCrc32c: false }]);

    await expectFailure(service.open(service.parse(await wrap(randomBytes(32)))), "KEY_SERVICE_REQUEST_CORRUPTED");
  });

  it("reports a key service that returned no plaintext", async () => {
    const { service, wrap, kmsClient } = setup();
    kmsClient.asymmetricDecrypt.mockResolvedValue([{ verifiedCiphertextCrc32c: true }]);

    await expectFailure(service.open(service.parse(await wrap(randomBytes(32)))), "KEY_SERVICE_PLAINTEXT_MISSING");
  });

  it("reports a key service whose plaintext fails its own checksum", async () => {
    const { service, wrap, kmsClient } = setup();
    kmsClient.asymmetricDecrypt.mockResolvedValue([{ plaintext: Buffer.alloc(32), plaintextCrc32c: { value: "1" }, verifiedCiphertextCrc32c: true }]);

    await expectFailure(service.open(service.parse(await wrap(randomBytes(32)))), "KEY_SERVICE_RESPONSE_CORRUPTED");
  });

  it("reports an altered ciphertext as an authentication failure", async () => {
    const { service, wrap } = setup();
    const parts = (await wrap(randomBytes(32))).split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");

    await expectFailure(service.open(service.parse(parts.join("."))), "AUTHENTICATION_FAILED");
  });

  it("reports an altered protected header as an authentication failure, because the header is the additional authenticated data", async () => {
    const { service, wrap } = setup();
    const [protectedHeader, ...rest] = (await wrap(randomBytes(32))).split(".");
    const claims = JSON.parse(Buffer.from(protectedHeader, "base64url").toString());
    const forged = Buffer.from(JSON.stringify({ ...claims, kid: "sdl-secrets.v9" })).toString("base64url");

    await expectFailure(service.open(service.parse([forged, ...rest].join("."))), "AUTHENTICATION_FAILED");
  });

  it("reports a content encryption key that is not the length AES-256 requires as an authentication failure", async () => {
    const { service, wrap, kmsClient } = setup();
    const shortKey = Buffer.alloc(16);
    kmsClient.asymmetricDecrypt.mockResolvedValue([
      { plaintext: shortKey, plaintextCrc32c: { value: String(crc32c.calculate(shortKey)) }, verifiedCiphertextCrc32c: true }
    ]);

    await expectFailure(service.open(service.parse(await wrap(randomBytes(32)))), "AUTHENTICATION_FAILED");
  });

  function setup() {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });

    const wrap = (payload: Buffer, claims?: Record<string, unknown>) =>
      new CompactEncrypt(payload).setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM", kid: KID, ...claims }).encrypt(publicKey);

    const kmsClient = mock<SdlSecretsKmsClient>();
    kmsClient.asymmetricDecrypt.mockImplementation(async request => {
      const plaintext = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(request.ciphertext));

      return [
        {
          plaintext,
          plaintextCrc32c: { value: String(crc32c.calculate(plaintext)) },
          verifiedCiphertextCrc32c: true
        } satisfies protos.google.cloud.kms.v1.IAsymmetricDecryptResponse
      ];
    });

    const service = new KmsWrappedJweService({ client: kmsClient, versionName: VERSION_NAME, kid: KID });

    return { service, wrap, kmsClient, privateKey };
  }
});
