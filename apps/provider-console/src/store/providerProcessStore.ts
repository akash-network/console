import { atom, type WritableAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import type { CertManagerFormState, CertManagerSecretsState } from "@src/types/certManager";
import { EMPTY_CERT_MANAGER_SECRETS, EMPTY_CERT_MANAGER_STATE } from "@src/types/certManager";
import type { MachineInformation } from "@src/types/machineAccess";
import { createWalletScopedStorage } from "@src/utils/walletScopedStorage";

interface ProviderSteps {
  serverAccess: boolean;
  providerConfig: boolean;
  providerAttribute: boolean;
  providerPricing: boolean;
  portsAndDNS: boolean;
  certManager: boolean;
  walletImport: boolean;
}

interface ProviderConfig {
  domain: string;
  organization: string;
  email: string;
}

interface ProviderPricing {
  cpu: number;
  memory: number;
  storage: number;
  gpu: number;
  persistentStorage: number;
  ipScalePrice: number;
  endpointBidPrice: number;
}

export interface ProviderAttribute {
  key: string;
  value: string;
}

interface ProviderProcess {
  machines: MachineInformation[];
  storeInformation: boolean;
  process: ProviderSteps;
  config: ProviderConfig;
  pricing: ProviderPricing;
  attributes: ProviderAttribute[];
  certManager: CertManagerFormState;
  actionId: string | null;
}

const providerProcessAtom: WritableAtom<ProviderProcess, [ProviderProcess | ((prev: ProviderProcess) => ProviderProcess)], void> =
  atomWithStorage<ProviderProcess>(
    "providerProcess",
    {
      machines: [],
      storeInformation: false,
      config: {
        domain: "",
        organization: "",
        email: ""
      },
      process: {
        serverAccess: false,
        providerConfig: false,
        providerAttribute: false,
        providerPricing: false,
        portsAndDNS: false,
        certManager: false,
        walletImport: false
      },
      pricing: {
        cpu: 1.6,
        memory: 0.8,
        storage: 0.02,
        gpu: 100,
        persistentStorage: 0.3,
        ipScalePrice: 5,
        endpointBidPrice: 0.5
      },
      attributes: [],
      certManager: EMPTY_CERT_MANAGER_STATE,
      actionId: null
    },
    createWalletScopedStorage<ProviderProcess>("providerProcess")
  ) as WritableAtom<ProviderProcess, [ProviderProcess | ((prev: ProviderProcess) => ProviderProcess)], void>;

// Holds cert-manager credentials (Cloudflare API token, GCP service account JSON).
// Intentionally a plain in-memory atom — never persisted, so secrets do not
// outlive the JS context. Cleared on wallet change via resetProviderProcess.
const certManagerSecretsAtom = atom<CertManagerSecretsState>(EMPTY_CERT_MANAGER_SECRETS);

const resetProviderProcess = atom(null, (get, set) => {
  set(certManagerSecretsAtom, EMPTY_CERT_MANAGER_SECRETS);
  set(providerProcessAtom, {
    machines: [],
    storeInformation: false,
    config: {
      domain: "",
      organization: "",
      email: ""
    },
    process: {
      serverAccess: false,
      providerConfig: false,
      providerAttribute: false,
      providerPricing: false,
      portsAndDNS: false,
      certManager: false,
      walletImport: false
    },
    pricing: {
      cpu: 1.6,
      memory: 0.8,
      storage: 0.02,
      gpu: 100,
      persistentStorage: 0.3,
      ipScalePrice: 5,
      endpointBidPrice: 0.5
    },
    attributes: [],
    certManager: EMPTY_CERT_MANAGER_STATE,
    actionId: null
  });
});

const providerProcessStore = {
  providerProcessAtom,
  certManagerSecretsAtom,
  resetProviderProcess
};

export default providerProcessStore;
