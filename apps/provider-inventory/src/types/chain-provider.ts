export interface SelfAttribute {
  key: string;
  value: string;
}

export interface SignedAttribute {
  key: string;
  value: string;
  auditor: string;
}

export interface ChainProvider {
  owner: string;
  hostUri: string;
  selfAttributes: SelfAttribute[];
  signedAttributes: SignedAttribute[];
  auditedBy: string[];
}

export interface ChainProviderWithOfflineSince extends ChainProvider {
  offlineSince: Date | null;
}

export interface DiscoveredChainProvider extends ChainProvider {
  verification: StoredProviderVerification;
}
import type { StoredProviderVerification } from "./provider-verification";
