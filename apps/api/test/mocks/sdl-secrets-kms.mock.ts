import type { protos } from "@google-cloud/kms";
import crc32c from "fast-crc32c";
import { constants, generateKeyPairSync, privateDecrypt } from "node:crypto";
import { container } from "tsyringe";
import { mock } from "vitest-mock-extended";

import type { SdlSecretsKmsClient, SdlSecretsKmsTarget } from "@src/deployment/providers/kms.provider";
import { SDL_SECRETS_KMS_TARGET } from "@src/deployment/providers/kms.provider";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";

export const SDL_SECRETS_KID = "sdl-secrets.v1";

const VERSION_NAME = "projects/console-test/locations/global/keyRings/console-api/cryptoKeys/sdl-secrets/cryptoKeyVersions/1";

/** Every create carrying an env value unwraps a data key, so any spec exercising `POST /v1/deployments` must call this or reach the real Cloud KMS: it doubles that boundary with a real RSA key, registered at module scope so nothing resolves the real target first. */
export function registerFakeSdlSecretsKms() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const client = mock<SdlSecretsKmsClient>();

  client.getPublicKey.mockResolvedValue([
    { name: VERSION_NAME, pem: publicKeyPem, pemCrc32c: { value: String(crc32c.calculate(publicKeyPem)) }, algorithm: "RSA_DECRYPT_OAEP_3072_SHA256" }
  ]);

  client.asymmetricDecrypt.mockImplementation(async request => {
    const plaintext = privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(request.ciphertext!));

    return [
      {
        plaintext,
        plaintextCrc32c: { value: String(crc32c.calculate(plaintext)) },
        verifiedCiphertextCrc32c: true
      } satisfies protos.google.cloud.kms.v1.IAsymmetricDecryptResponse
    ];
  });

  container.register<SdlSecretsKmsTarget>(SDL_SECRETS_KMS_TARGET, { useValue: { client, versionName: VERSION_NAME, kid: SDL_SECRETS_KID } });

  return { client, publicKey };
}

/** A spec that skips this gets a 503 on its first create for a user, exactly as an instance whose boot-time warm-up failed would, because wrapping a new data key peeks at the sealing key cache rather than waiting on it. */
export async function warmSealingKeyAsBootWould() {
  await container.resolve(SdlSecretsSealingKeyService).getSealingKey();
}
