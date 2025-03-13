export interface ProviderAttribute {
  key: string;
  value: string;
}

export interface ProviderInfo {
  email: string;
  website: string;
}

export interface Provider {
  owner: string;
  host_uri: string;
  attributes: ProviderAttribute[];
  info: ProviderInfo;
}

export interface GetProviderResponse {
  provider: Provider;
}
