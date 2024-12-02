import { ControlMachineWithAddress } from "@src/types/controlMachine";

export function sanitizeMachineAccess(machine: ControlMachineWithAddress | null) {
    if (!machine) {
        return undefined;
    }
    return {
        hostname: machine.access.hostname,
        port: machine.access.port,
        username: machine.access.username,
        keyfile: machine.access.file || null,
        password: machine.access.password || null,
        passphrase: machine.access.passphrase || null
    };
}
