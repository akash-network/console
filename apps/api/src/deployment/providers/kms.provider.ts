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
  getPublicKey(request: { name: string }, options?: CallOptions): Promise<[protos.google.cloud.kms.v1.IPublicKey, ...unknown[]]>;
  asymmetricDecrypt(request: {
    name: string;
    ciphertext: Buffer;
    ciphertextCrc32c: { value: number };
  }): Promise<[protos.google.cloud.kms.v1.IAsymmetricDecryptResponse, ...unknown[]]>;
}

/**
 * The crypto key version SDL secrets are sealed to, and the short alias clients put in a seal's
 * `kid`. `asymmetricDecrypt` names an exact version and cannot infer one from a ciphertext, so the
 * alias is what later maps an incoming seal back to `versionName`.
 */
export interface SdlSecretsKmsTarget {
  client: SdlSecretsKmsClient;
  versionName: string;
  kid: string;
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
    const version = config.get("GCP_KMS_KEY_VERSION");

    return {
      client,
      versionName: client.cryptoKeyVersionPath(auth.project_id, config.get("GCP_KMS_LOCATION"), config.get("GCP_KMS_KEY_RING"), key, version),
      kid: `${key}.v${version}`
    };
  })
});
