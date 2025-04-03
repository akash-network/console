import { atomWithStorage } from "jotai/utils";

import type { ControlMachineWithAddress } from "@src/types/controlMachine";

const controlMachineAtom = atomWithStorage<ControlMachineWithAddress[]>("controlMachines", []);

const controlMachineStore = {
  controlMachineAtom
};

export default controlMachineStore;
