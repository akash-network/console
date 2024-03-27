import { ProviderRegionValue } from "./providerAttributes";

export type Service = {
  id: string;
  title: string;
  image: string;
  profile: Profile;
  expose: Expose[];
  command?: Command;
  env?: EnvironmentVariable[];
  placement: Placement;
  count: number;
};

export type ImportService = {
  id: string;
  title?: string;
  image?: string;
  profile?: Profile;
  expose?: Expose[];
  command?: Command;
  env?: EnvironmentVariable[];
  placement?: Placement;
  count?: number;
};

export type Profile = {
  cpu: number;
  hasGpu?: boolean;
  // gpu?: number;
  // gpuVendor?: string;
  gpuModels?: ProfileGpuModel[];
  ram: number;
  ramUnit: string;
  storage: number;
  storageUnit: string;
  hasPersistentStorage?: boolean;
  persistentStorage?: number;
  persistentStorageUnit?: string;
  persistentStorageParam?: ServicePersistentStorage;
};

export type ProfileGpuModel = {
  unit: number;
  vendor: string;
  name: string;
  memory: string;
  interface: string;
};

export type ServicePersistentStorage = {
  name: string;
  type: string;
  mount: string;
  readOnly?: boolean;
};

export type Command = {
  command: string;
  arg: string;
};

export type EnvironmentVariable = {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
};

export type Expose = {
  id: string;
  port: number;
  as: number;
  proto?: "http" | "https" | "tcp";
  to?: To[];
  global?: boolean;
  accept?: Accept[];
  hasCustomHttpOptions?: boolean;
  httpOptions?: ServiceExposeHTTPOptions;
  ipName?: string;
};

export type To = {
  id: string;
  value: string;
};

export type Accept = {
  id: string;
  value: string;
};

export type ServiceExposeHTTPOptions = {
  maxBodySize: number;
  readTimeout: number;
  sendTimeout: number;
  nextTries: number;
  nextTimeout: number;
  nextCases: string[];
};

export type SdlBuilderFormValues = {
  services: Service[];
};

export type SdlBuilderCommandFormValues = {
  commands: Command[];
};

export type Placement = {
  name: string;
  attributes?: PlacementAttribute[];
  signedBy?: {
    allOf: SignedBy[];
    anyOf: SignedBy[];
  };
  pricing: {
    // profile: string;
    amount: number;
    denom: string;
  };
};

export type PlacementAttribute = {
  id: string;
  key: string;
  value: string;
};

export type SignedBy = {
  id: string;
  value: string;
};

export type ITemplate = {
  id: string;
  userId: string;
  username: string;
  title: string;
  description: string;
  isPublic: boolean;
  cpu: number;
  ram: number;
  storage: number;
  sdl: string;
  isFavorite: boolean;
};

export type SdlSaveTemplateFormValues = {
  title: string;
  visibility: string;
};

export type RentGpusFormValues = {
  services: Service[];
  region: Partial<ProviderRegionValue>;
};
