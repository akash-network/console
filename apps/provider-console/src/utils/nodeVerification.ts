import { MachineAccess } from "@src/components/machine/MachineAccessForm";
import { SystemInfo } from "../types/systemInfo";
import restClient from "./restClient";

/**
 * Processes a keyfile into a base64 encoded string with proper prefix
 * @param keyfile - The keyfile content
 * @returns Base64 encoded keyfile or null if no keyfile provided
 */
export const processKeyfile = (keyfile?: string): string | null => {
  if (!keyfile) return null;

  try {
    // If keyfile is already base64 encoded with correct prefix, use it directly
    if (keyfile.startsWith("data:application/octet-stream;base64,")) {
      return keyfile;
    } else if (keyfile.match(/^[A-Za-z0-9+/=]+$/)) {
      // If it's base64 but missing prefix, add it
      return `data:application/octet-stream;base64,${keyfile}`;
    } else {
      // Otherwise encode it to base64 with prefix
      return `data:application/octet-stream;base64,${btoa(keyfile)}`;
    }
  } catch (error) {
    console.error("Error encoding keyfile:", error);
    throw new Error("Failed to process keyfile. The keyfile content could not be encoded properly.");
  }
};

/**
 * Verifies a control machine's connectivity and returns system information
 * @param access - Machine access details
 * @returns System information from the server
 */
export const verifyControlMachine = async (access: MachineAccess): Promise<SystemInfo> => {
  try {
    const encodedKeyfile = access.keyfile ? processKeyfile(access.keyfile) : null;

    const response = await restClient.post(
      "/verify/control-machine",
      {
        hostname: access.hostname,
        port: access.port || 22,
        username: access.username,
        password: access.password || null,
        keyfile: encodedKeyfile,
        passphrase: access.passphrase || null
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );

    if (response?.status?.toString().toLowerCase() !== "success") {
      throw new Error("Failed to verify control machine");
    }

    return response.data.system_info;
  } catch (error: any) {
    console.error("Control machine verification error:", error);
    throw new Error(error.response?.data?.detail?.error?.message || error.message || "Failed to verify server access");
  }
};

/**
 * Verifies a worker node's connectivity and returns system information
 * @param controlMachine - Control machine access details
 * @param workerNode - Worker node access details
 * @param isControlPlane - Whether the worker is a control plane node
 * @returns System information from the server
 */
export const verifyWorkerNode = async (controlMachine: MachineAccess, workerNode: MachineAccess, isControlPlane: boolean): Promise<SystemInfo> => {
  try {
    const controlKeyfile = controlMachine.keyfile ? processKeyfile(controlMachine.keyfile) : null;
    const workerKeyfile = workerNode.keyfile ? processKeyfile(workerNode.keyfile) : null;

    const request = {
      control_machine: {
        hostname: controlMachine.hostname,
        port: controlMachine.port || 22,
        username: controlMachine.username,
        keyfile: controlKeyfile,
        password: controlMachine.password || null,
        passphrase: controlMachine.passphrase || null
      },
      worker_node: {
        hostname: workerNode.hostname,
        port: workerNode.port || 22,
        username: workerNode.username,
        keyfile: workerKeyfile,
        password: workerNode.password || null,
        passphrase: workerNode.passphrase || null,
        is_control_plane: isControlPlane
      }
    };

    const response = await restClient.post("/verify/control-and-worker", request, {
      headers: { "Content-Type": "application/json" }
    });

    return response.data.system_info;
  } catch (error: any) {
    console.error("Worker node verification error:", error);
    throw new Error(error.response?.data?.detail?.error?.message || error.message || "Failed to verify server access");
  }
};
