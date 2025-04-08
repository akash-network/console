import React, { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@akashnetwork/ui/components";

import { MachineAccess, MachineAccessForm } from "@src/components/machine/MachineAccessForm";
import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useMachineAccessForm } from "@src/hooks/useMachineAccessForm";
import { SystemInfo } from "@src/types/systemInfo";

interface NodeInfo {
  access: MachineAccess;
  system_info: SystemInfo;
}

interface NodeFormProps {
  isControlPlane: boolean;
  nodeNumber: number;
  onComplete: (nodeInfo: NodeInfo) => void;
  _defaultValues?: MachineAccess | null;
  isSubmitting?: boolean;
}

export const NodeForm: React.FC<NodeFormProps> = ({ isControlPlane, nodeNumber, onComplete, _defaultValues, isSubmitting = false }) => {
  const { activeControlMachine } = useControlMachine();
  const [formKey, setFormKey] = useState(0); // Add key to force form reset
  const [lastSavedConfig, setLastSavedConfig] = useState<MachineAccess | null>(null);

  // Convert control machine access to proper MachineAccess format with proper types
  const controlMachineAccess = activeControlMachine?.access
    ? {
        hostname: activeControlMachine.access.hostname,
        port: activeControlMachine.access.port,
        username: activeControlMachine.access.username,
        password: activeControlMachine.access.password || undefined,
        // Use keyfile instead of file for SSH key content
        keyfile: activeControlMachine.access.keyfile || undefined,
        // Keep file for UI reference
        file: activeControlMachine.access.file || null,
        passphrase: activeControlMachine.access.passphrase || undefined
      }
    : null;

  // Use the shared machine access form logic
  const { isVerifying, error, verifyMachine } = useMachineAccessForm({
    controlMachine: controlMachineAccess,
    isControlPlane
  });

  const handleSubmit = async (formData: MachineAccess) => {
    if (!activeControlMachine) {
      return;
    }

    try {
      // Log the form data being submitted
      console.log(`Submitting form data for Node ${nodeNumber}:`, formData);

      // Verify the machine access
      const result = await verifyMachine(formData);

      if (!result) {
        return; // Verification failed
      }

      // Save config if requested
      if (formData.saveInformation) {
        setLastSavedConfig({
          ...formData,
          hostname: "" // Don't save hostname
        });
      } else {
        setLastSavedConfig(null);
      }

      // Log the output for debugging
      console.log(`Node ${nodeNumber} verified with hostname: ${formData.hostname}`);

      // Call onComplete with the form data and system info
      onComplete({
        access: formData,
        system_info: result.systemInfo
      });

      // Reset form after successful submission
      setFormKey(prev => prev + 1);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  // Get default values based on whether previous config should be used
  const getFormDefaults = (): Partial<MachineAccess> => {
    if (_defaultValues) {
      // If we're using defaults from a shared configuration, make sure hostname is empty
      console.log("Using _defaultValues in NodeForm:", _defaultValues);

      return {
        ..._defaultValues,
        hostname: "" // Always empty hostname when using shared configuration
      };
    }

    if (lastSavedConfig) {
      console.log("Using lastSavedConfig in NodeForm:", lastSavedConfig);

      return {
        ...lastSavedConfig,
        hostname: "" // Always empty hostname
      };
    }

    console.log("Using default values in NodeForm");

    return {
      hostname: "", // Always empty hostname
      username: "root", // Keep default username
      port: 22 // Keep default port
    };
  };

  // Log the actual form defaults for debugging
  const formDefaults = getFormDefaults();
  console.log("Final formDefaults:", formDefaults);

  return (
    <div className="space-y-6">
      {isControlPlane ? (
        <Alert>
          <AlertTitle>Control Plane Node {nodeNumber}</AlertTitle>
          <AlertDescription>This node will manage cluster operations and run workloads</AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertTitle>Worker Node {nodeNumber}</AlertTitle>
          <AlertDescription>This node will run workloads</AlertDescription>
        </Alert>
      )}

      <MachineAccessForm
        key={formKey} // Add key to force form reset
        onSubmit={handleSubmit}
        defaultValues={formDefaults}
        isVerifying={isVerifying}
        error={error}
        isPublicIP={false}
        showSaveConfig={true}
        disabled={isSubmitting}
      />
    </div>
  );
};
