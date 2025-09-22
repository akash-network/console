// Cloudflare provider info type
export interface CloudflareProviderInfo {
  provider: "cloudflare";
  apiToken: string;
}

// Google Cloud provider info type
export interface GoogleCloudProviderInfo {
  provider: "googleCloud";
  projectId: string;
  privateKeyId: string;
  privateKey: string;
  clientEmail: string;
  clientId: string;
  authUri: string;
  tokenUri: string;
  authProviderX509CertUrl: string;
  clientX509CertUrl: string;
}

// Provider info union type
export type ProviderInfo = CloudflareProviderInfo | GoogleCloudProviderInfo;

// Main JWT enablement type
export interface JwtEnablementFormData {
  email: string;
  provider_info: ProviderInfo;
}

// JWT status response type
export interface JwtStatus {
  message: string;
  letsencrypt_jwt_status: boolean;
  provider?: "cloudflare" | "googleCloud";
  email?: string;
}

// JWT enablement response type
export interface JwtEnablementResponse {
  message: string;
  action_id: string;
}

// DNS provider options
export const DNS_PROVIDERS = [
  { value: "cloudflare", label: "Cloudflare" },
  { value: "googleCloud", label: "Google Cloud DNS" }
] as const;

export type DnsProvider = (typeof DNS_PROVIDERS)[number]["value"];
