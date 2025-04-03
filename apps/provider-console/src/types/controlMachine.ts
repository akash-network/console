import type { MachineInformation } from "./machineAccess";

export interface ControlMachineWithAddress extends MachineInformation {
  address: string;
}
