export type DnsProvider = "cloudflare" | "clouddns";

export interface CloudflareCreds {
  api_token: string;
}

export interface CloudDnsCreds {
  project: string;
  service_account_json: string;
}

export type CertManagerPayload =
  | {
      acme_email?: string;
      use_staging: boolean;
      dns_provider: "cloudflare";
      cloudflare: CloudflareCreds;
    }
  | {
      acme_email?: string;
      use_staging: boolean;
      dns_provider: "clouddns";
      clouddns: CloudDnsCreds;
    };

// Persisted (non-secret) slice of the cert-manager form.
export interface CertManagerFormState {
  acme_email: string;
  dns_provider: DnsProvider | "";
  clouddns: { project: string };
}

// In-memory only slice. Holds the actual credentials and must NOT be persisted
// to localStorage — see providerProcessStore.ts.
export interface CertManagerSecretsState {
  cloudflare: { api_token: string };
  clouddns: { service_account_json: string };
}

export const EMPTY_CERT_MANAGER_STATE: CertManagerFormState = {
  acme_email: "",
  dns_provider: "",
  clouddns: { project: "" }
};

export const EMPTY_CERT_MANAGER_SECRETS: CertManagerSecretsState = {
  cloudflare: { api_token: "" },
  clouddns: { service_account_json: "" }
};

export function buildCertManagerPayload(state: CertManagerFormState, secrets: CertManagerSecretsState): CertManagerPayload {
  if (state.dns_provider === "cloudflare") {
    return {
      ...(state.acme_email ? { acme_email: state.acme_email } : {}),
      use_staging: false,
      dns_provider: "cloudflare",
      cloudflare: { api_token: secrets.cloudflare.api_token }
    };
  }
  if (state.dns_provider === "clouddns") {
    return {
      ...(state.acme_email ? { acme_email: state.acme_email } : {}),
      use_staging: false,
      dns_provider: "clouddns",
      clouddns: {
        project: state.clouddns.project,
        service_account_json: secrets.clouddns.service_account_json
      }
    };
  }
  throw new Error("dns_provider must be set before building cert-manager payload");
}

export function hasRequiredCertManagerSecrets(state: CertManagerFormState, secrets: CertManagerSecretsState): boolean {
  if (state.dns_provider === "cloudflare") {
    return secrets.cloudflare.api_token.trim().length > 0;
  }
  if (state.dns_provider === "clouddns") {
    return secrets.clouddns.service_account_json.trim().length > 0;
  }
  return false;
}
