import { MachineInformation } from "@src/types/machineAccess";
import { atomWithStorage } from "jotai/utils";

interface ProviderSteps {
  serverAccess: boolean,
  walletImport: boolean,
  providerConfig: boolean,
  providerAttribute: boolean,
  providerPricing: boolean
}

interface ProviderProcess {
  machines: MachineInformation[];
  storeInformation: boolean,
  process: ProviderSteps
}

const providerProcessAtom = atomWithStorage<ProviderProcess>("providerProcess", {
  machines: [],
  storeInformation: false,
  process: {
    serverAccess: false,
    walletImport: false,
    providerConfig: false,
    providerAttribute: false,
    providerPricing: false
  }
});

export default {
  providerProcessAtom
};
