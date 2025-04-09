import { useState } from "react";

import type { MachineAccess } from "@src/components/machine/MachineAccessForm";
import type { SystemInfo } from "@src/types/systemInfo";
import { verifyControlMachine, verifyWorkerNode } from "@src/utils/nodeVerification";

export interface MachineVerificationProps {
  controlMachine?: MachineAccess | null;
  isControlPlane?: boolean;
}

export interface MachineVerificationResult {
  isVerifying: boolean;
  error: { message: string; details: string[] } | null;
  verifyMachine: (formData: MachineAccess) => Promise<{ access: MachineAccess; systemInfo: SystemInfo } | null>;
  resetError: () => void;
}

export const useMachineAccessForm = ({ controlMachine, isControlPlane = false }: MachineVerificationProps = {}): MachineVerificationResult => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  const resetError = () => setError(null);

  const verifyMachine = async (formData: MachineAccess) => {
    setIsVerifying(true);
    resetError();

    try {
      let systemInfo: SystemInfo;

      if (controlMachine) {
        systemInfo = await verifyWorkerNode(controlMachine, formData, isControlPlane);
      } else {
        systemInfo = await verifyControlMachine(formData);
      }

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
