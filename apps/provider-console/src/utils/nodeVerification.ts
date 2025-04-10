import type { MachineAccess } from "@src/components/machine/MachineAccessForm";
import type { SystemInfo } from "../types/systemInfo";
import restClient from "./restClient";

/**
 * Processes a keyfile into a base64 encoded string with proper prefix
 * @param keyfile - The keyfile content
 * @returns Base64 encoded keyfile or null if no keyfile provided
 */
export const processKeyfile = (keyfile?: string): string | null => {
  if (!keyfile) return null;

  try {
    // If keyfile already has data: prefix, it's already in the correct format
    if (keyfile.startsWith("data:")) {
      return keyfile;
    }

    // Determine the keyfile type based on content
    let mimeType = "application/octet-stream";

    // Check for OpenSSH format
    if (keyfile.includes("-----BEGIN") && keyfile.includes("PRIVATE KEY-----")) {
      if (keyfile.includes("-----BEGIN RSA PRIVATE KEY-----")) {
        mimeType = "application/x-pem-file";
      } else if (keyfile.includes("-----BEGIN OPENSSH PRIVATE KEY-----")) {
        mimeType = "application/x-openssh-key";
      } else {
        mimeType = "application/x-pem-file"; // Generic PEM format for other types
      }
    } else if (keyfile.includes("PuTTY-User-Key-File")) {
      mimeType = "application/x-putty-private-key";
    }

    // If it's already base64 but missing prefix, add it with the detected MIME type
    if (keyfile.match(/^[A-Za-z0-9+/=]+$/)) {
      return `data:${mimeType};base64,${keyfile}`;
    } else {
      // Otherwise encode it to base64 with the detected MIME type
      return `data:${mimeType};base64,${btoa(keyfile)}`;
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
