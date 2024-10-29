import { MachineInformation } from "@src/types/machineAccess";
import { atomWithStorage } from "jotai/utils";

const controlMachineAtom = atomWithStorage<MachineInformation>("controlMachine", {
  access: null,
  systemInfo: null
});

export default {
  controlMachineAtom,
};
