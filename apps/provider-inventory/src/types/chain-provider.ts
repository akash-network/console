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
  createdHeight: bigint;
  selfAttributes: SelfAttribute[];
  signedAttributes: SignedAttribute[];
}
