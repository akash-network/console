import React, { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@akashnetwork/ui/components";

import type { MachineAccess } from "@src/components/machine/MachineAccessForm";
import { MachineAccessForm } from "@src/components/machine/MachineAccessForm";
import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useMachineAccessForm } from "@src/hooks/useMachineAccessForm";
import type { SystemInfo } from "@src/types/systemInfo";

interface NodeInfo {
  access: MachineAccess;
  system_info: SystemInfo;
}

interface NodeFormProps {
  isControlPlane: boolean;
  isEtcd?: boolean;
  nodeNumber: number;
  onComplete: (nodeInfo: NodeInfo) => void;
  _defaultValues?: MachineAccess | null;
  isSubmitting?: boolean;
}

export const NodeForm: React.FC<NodeFormProps> = ({ isControlPlane, isEtcd = false, nodeNumber, onComplete, _defaultValues, isSubmitting = false }) => {
  const { activeControlMachine } = useControlMachine();
  const [formKey, setFormKey] = useState(0);
  const [lastSavedConfig, setLastSavedConfig] = useState<MachineAccess | null>(null);

  const controlMachineAccess = activeControlMachine?.access
    ? {
        hostname: activeControlMachine.access.hostname,
        port: activeControlMachine.access.port,
        username: activeControlMachine.access.username,
        password: activeControlMachine.access.password || undefined,
        keyfile: activeControlMachine.access.keyfile || undefined,
        file: activeControlMachine.access.file || null,
        passphrase: activeControlMachine.access.passphrase || undefined
      }
    : null;

  const { isVerifying, error, verifyMachine } = useMachineAccessForm({
    controlMachine: controlMachineAccess,
    isControlPlane
  });

  const handleSubmit = async (formData: MachineAccess) => {
    if (!activeControlMachine) {
      return;
    }

    try {
      const result = await verifyMachine(formData);

      if (!result) {
        return;
      }

      if (formData.saveInformation) {
        setLastSavedConfig({
          ...formData,
          hostname: ""
        });
      } else {
        setLastSavedConfig(null);
      }

      onComplete({
        access: formData,
        system_info: result.systemInfo
      });

      setFormKey(prev => prev + 1);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  const getFormDefaults = (): Partial<MachineAccess> => {
    if (_defaultValues) {
      return {
        ..._defaultValues,
        hostname: ""
      };
    }

    if (lastSavedConfig) {
      return {
        ...lastSavedConfig,
        hostname: ""
      };
    }

    return {
      hostname: "",
      username: "root",
      port: 22
    };
  };

  const formDefaults = getFormDefaults();

  const getNodeAlert = () => {
    if (isControlPlane && isEtcd) {
      return (
        <Alert>
          <AlertTitle>Control Plane + etcd Node {nodeNumber}</AlertTitle>
          <AlertDescription>This node will manage cluster operations, participate in consensus voting, and run workloads</AlertDescription>
        </Alert>
      );
    } else if (isControlPlane) {
      return (
        <Alert>
          <AlertTitle>Control Plane Node {nodeNumber}</AlertTitle>
          <AlertDescription>This node will manage cluster operations and run workloads</AlertDescription>
        </Alert>
      );
    } else {
      return (
        <Alert>
          <AlertTitle>Worker Node {nodeNumber}</AlertTitle>
          <AlertDescription>This node will run workloads</AlertDescription>
        </Alert>
      );
    }
  };

  return (
    <div className="space-y-6">
      {getNodeAlert()}

      <MachineAccessForm
        key={formKey}
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
