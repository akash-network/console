import { MachineInformation } from "@src/types/machineAccess";
import { atom } from 'jotai';
import { atomWithStorage } from "jotai/utils";

interface ProviderSteps {
  serverAccess: boolean,
  providerConfig: boolean,
  providerAttribute: boolean,
  providerPricing: boolean,
  walletImport: boolean,
}

interface ProviderConfig {
  domain: string,
  organization: string,
  email: string
}

interface ProviderPricing {
  cpu: number,
  memory: number,
  storage: number,
  gpu: number,
  persistentStorage: number,
  ipScalePrice: number,
  endpointBidPrice: number
}

interface ProviderAttribute { key: string, value: string, customKey: string }

interface ProviderProcess {
  machines: MachineInformation[],
  storeInformation: boolean,
  process: ProviderSteps,
  config: ProviderConfig,
  pricing: ProviderPricing,
  attributes: ProviderAttribute[],
  actionId: string | null
}

const providerProcessAtom = atomWithStorage<ProviderProcess>("providerProcess", {
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
    walletImport: false,
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
  actionId: null
});

const resetProviderProcess = atom(
  null,
  (get, set) => {
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
        walletImport: false,
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
      actionId: null
    });
  }
);

export default {
  providerProcessAtom,
  resetProviderProcess
};
