import type { IdentityPoolClientOptions } from "google-auth-library";
import { readFile } from "node:fs/promises";

export type WorkloadIdentity = {
  /** `//iam.googleapis.com/projects/<number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>` */
  audience: string;
  tokenFile: string;
  serviceAccount?: string;
};

/** Reads the token here rather than naming its file in `credential_source`, because the library resolves that path through symlinks the Node permission model does not let it read. */
export function workloadIdentityOptions({ audience, tokenFile, serviceAccount }: WorkloadIdentity): IdentityPoolClientOptions {
  return {
    type: "external_account",
    audience,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    ...(serviceAccount && {
      service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccount}:generateAccessToken`
    }),
    subject_token_supplier: { getSubjectToken: async () => (await readFile(tokenFile, "utf8")).trim() }
  };
}
