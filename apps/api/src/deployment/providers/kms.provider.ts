import type { protos } from "@google-cloud/kms";
import { KeyManagementServiceClient } from "@google-cloud/kms";
import { JWT, OAuth2Client } from "google-auth-library";
import { type CallOptions, grpc } from "google-gax";
import type { InjectionToken } from "tsyringe";
import { container, instancePerContainerCachingFactory } from "tsyringe";

import { DisposableRegistry } from "@src/core/lib/disposable-registry/disposable-registry";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";

const CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

/** The Cloud KMS operations the console performs on the SDL secrets key, narrowed so they can be doubled in tests. */
export interface SdlSecretsKmsClient {
  getCryptoKeyVersion(request: { name: string }, options?: CallOptions): Promise<[protos.google.cloud.kms.v1.ICryptoKeyVersion, ...unknown[]]>;
  getPublicKey(request: { name: string }, options?: CallOptions): Promise<[protos.google.cloud.kms.v1.IPublicKey, ...unknown[]]>;
  asymmetricDecrypt(request: {
    name: string;
    ciphertext: Buffer;
    ciphertextCrc32c: { value: number };
  }): Promise<[protos.google.cloud.kms.v1.IAsymmetricDecryptResponse, ...unknown[]]>;
}

/**
 * The crypto key version new wraps are sealed to, the short alias clients put in a seal's `kid`,
 * and the mapping from any alias of the same crypto key back to a version name. `versionName` and
 * `kid` name the write target alone; reads follow `resolveVersionName`, so raising the configured
 * version leaves everything wrapped under an earlier one readable.
 */
export interface SdlSecretsKmsTarget {
  client: SdlSecretsKmsClient;
  version: string;
  versionName: string;
  kid: string;
  resolveVersionName(kid: unknown): string | undefined;
}

/** Cloud KMS version ids are positive integers written without a leading zero, and no crypto key id contains a dot, so `<key>.v<digits>` splits unambiguously. */
const VERSION_ALIAS_SUFFIX = /^\.v([1-9][0-9]{0,9})$/;

function parseVersionAlias(key: string, kid: unknown): string | undefined {
  if (typeof kid !== "string" || !kid.startsWith(key)) return undefined;

  return VERSION_ALIAS_SUFFIX.exec(kid.slice(key.length))?.[1];
}

/** Takes `versionPath` rather than building the resource name itself, so the SDK stays the only thing that knows its shape. */
export function createSdlSecretsKmsTarget(input: {
  client: SdlSecretsKmsClient;
  versionPath: (version: string) => string;
  key: string;
  version: string;
}): SdlSecretsKmsTarget {
  const { client, versionPath, key, version } = input;

  return {
    client,
    version,
    versionName: versionPath(version),
    kid: `${key}.v${version}`,
    resolveVersionName(kid) {
      const resolved = parseVersionAlias(key, kid);

      return resolved && versionPath(resolved);
    }
  };
}

export const KMS_CLIENT: InjectionToken<KeyManagementServiceClient> = Symbol("KMS_CLIENT");

export const SDL_SECRETS_KMS_TARGET: InjectionToken<SdlSecretsKmsTarget> = Symbol("SDL_SECRETS_KMS_TARGET");

container.register(KMS_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const auth = c.resolve(DeploymentConfigService).get("GCP_KMS_AUTH");
    let client: KeyManagementServiceClient;

    if ("client_email" in auth) {
      client = new KeyManagementServiceClient({
        projectId: auth.project_id,
        authClient: new JWT({ email: auth.client_email, key: auth.private_key, scopes: [CLOUD_PLATFORM_SCOPE] })
      });
    } else {
      const kmsServiceUrl = new URL(auth.servicePath);
      client = new KeyManagementServiceClient({
        projectId: auth.project_id,
        servicePath: kmsServiceUrl.hostname,
        port: Number(kmsServiceUrl.port),
        sslCreds: grpc.credentials.createInsecure(),
        authClient: new OAuth2Client()
      });
    }

    c.resolve(DisposableRegistry).register({ dispose: () => client.close() });

    return client;
  })
});

container.register(SDL_SECRETS_KMS_TARGET, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(DeploymentConfigService);
    const auth = config.get("GCP_KMS_AUTH");
    const client = c.resolve<KeyManagementServiceClient>(KMS_CLIENT);
    const key = config.get("GCP_KMS_KEY");

    return createSdlSecretsKmsTarget({
      client,
      versionPath: version => client.cryptoKeyVersionPath(auth.project_id, config.get("GCP_KMS_LOCATION"), config.get("GCP_KMS_KEY_RING"), key, version),
      key,
      version: config.get("GCP_KMS_KEY_VERSION")
    });
  })
});
