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

interface ProviderProcess {
  machines: MachineInformation[],
  storeInformation: boolean,
  process: ProviderSteps,
  config: ProviderConfig
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
  }
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
      }
    });
  }
);

export default {
  providerProcessAtom,
  resetProviderProcess
};
