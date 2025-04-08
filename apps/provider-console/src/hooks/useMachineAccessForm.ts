import { useState } from "react";

import type { MachineAccess } from "@src/components/machine/MachineAccessForm";
import type { SystemInfo } from "@src/types/systemInfo";
import { verifyControlMachine, verifyWorkerNode } from "@src/utils/nodeVerification";

export interface MachineVerificationProps {
  /**
   * Optional control machine for verifying worker nodes
   */
  controlMachine?: MachineAccess | null;
  /**
   * Whether the node being configured is a control plane node
   */
  isControlPlane?: boolean;
}

export interface MachineVerificationResult {
  /**
   * Current verification state
   */
  isVerifying: boolean;
  /**
   * Error information if verification failed
   */
  error: { message: string; details: string[] } | null;
  /**
   * Function to verify a machine's access
   */
  verifyMachine: (formData: MachineAccess) => Promise<{ access: MachineAccess; systemInfo: SystemInfo } | null>;
  /**
   * Reset error state
   */
  resetError: () => void;
}

/**
 * Hook for handling machine access verification logic
 */
export const useMachineAccessForm = ({ controlMachine, isControlPlane = false }: MachineVerificationProps = {}): MachineVerificationResult => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  const resetError = () => setError(null);

  const verifyMachine = async (formData: MachineAccess) => {
    setIsVerifying(true);
    resetError();

    try {
      let systemInfo: SystemInfo;

      // If controlMachine is provided, verify as a worker node
      if (controlMachine) {
        systemInfo = await verifyWorkerNode(controlMachine, formData, isControlPlane);
      } else {
        // Otherwise verify as a control machine
        systemInfo = await verifyControlMachine(formData);
      }

      // Return the verified machine information
      return {
        access: {
          hostname: formData.hostname,
          port: formData.port || 22,
          username: formData.username,
          password: formData.password,
          keyfile: formData.keyfile,
          file: formData.file,
          passphrase: formData.passphrase,
          saveInformation: formData.saveInformation
        },
        systemInfo
      };
    } catch (error: any) {
      console.error("Verification error:", error);
      setError({
        message: "Failed to verify server access",
        details: [error.message || "Please check your credentials and try again."]
      });
      return null;
    } finally {
      setIsVerifying(false);
    }
  };

  return {
    isVerifying,
    error,
    verifyMachine,
    resetError
  };
};
