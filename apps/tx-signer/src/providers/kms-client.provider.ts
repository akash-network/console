import { KeyManagementServiceClient } from "@google-cloud/kms";
import { IdentityPoolClient } from "google-auth-library";
import { container, type InjectionToken, instancePerContainerCachingFactory } from "tsyringe";

import type { KmsAsymmetricKeyClient } from "@src/lib/kms-wallet/kms-signing-key";
import { workloadIdentityOptions } from "@src/lib/kms-wallet/workload-identity-options";
import type { KmsDecryptClient } from "@src/lib/seed-decrypter/kms-seed-decrypter";
import { AppConfigService } from "@src/services/app-config/app-config.service";

export type KmsClient = KmsAsymmetricKeyClient & KmsDecryptClient;

export const KMS_CLIENT: InjectionToken<KmsClient> = Symbol("KMS_CLIENT");

/** Never falls back to Google's default credential lookup: it probes files the Node permission model denies, which ends the process. */
container.register(KMS_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(AppConfigService);
    const audience = config.get("GCP_WORKLOAD_IDENTITY_AUDIENCE");

    if (!audience) {
      throw new Error("GCP_WORKLOAD_IDENTITY_AUDIENCE is required to reach Cloud KMS");
    }

    return new KeyManagementServiceClient({
      authClient: new IdentityPoolClient(
        workloadIdentityOptions({
          audience,
          tokenFile: config.get("GCP_WORKLOAD_IDENTITY_TOKEN_FILE"),
          serviceAccount: config.get("GCP_KMS_SERVICE_ACCOUNT")
        })
      )
    });
  })
});
