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

export interface CertManagerFormState {
  acme_email: string;
  dns_provider: DnsProvider | "";
  cloudflare: CloudflareCreds;
  clouddns: CloudDnsCreds;
}

export const EMPTY_CERT_MANAGER_STATE: CertManagerFormState = {
  acme_email: "",
  dns_provider: "",
  cloudflare: { api_token: "" },
  clouddns: { project: "", service_account_json: "" }
};

export function buildCertManagerPayload(state: CertManagerFormState): CertManagerPayload {
  if (state.dns_provider === "cloudflare") {
    return {
      ...(state.acme_email ? { acme_email: state.acme_email } : {}),
      use_staging: false,
      dns_provider: "cloudflare",
      cloudflare: { api_token: state.cloudflare.api_token }
    };
  }
  if (state.dns_provider === "clouddns") {
    return {
      ...(state.acme_email ? { acme_email: state.acme_email } : {}),
      use_staging: false,
      dns_provider: "clouddns",
      clouddns: {
        project: state.clouddns.project,
        service_account_json: state.clouddns.service_account_json
      }
    };
  }
  throw new Error("dns_provider must be set before building cert-manager payload");
}
