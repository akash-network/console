"use client";
import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@akashnetwork/ui/components";
import { useAtom } from "jotai";

import type { MachineAccess } from "@src/components/machine/MachineAccessForm";
import { MachineAccessForm } from "@src/components/machine/MachineAccessForm";
import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useMachineAccessForm } from "@src/hooks/useMachineAccessForm";
import providerProcessStore from "@src/store/providerProcessStore";
import type { ControlMachineWithAddress } from "@src/types/controlMachine";
import type { MachineInformation } from "@src/types/machineAccess";

interface ServerFormProps {
  _currentServerNumber: number;
  onComplete: (formData: MachineAccess) => void;
  editMode?: boolean;
  controlMachine?: ControlMachineWithAddress | null;
  isControlPlane?: boolean;
  nodeNumber?: number;
  defaultValues?: MachineAccess | null;
}

export const ServerForm: React.FC<ServerFormProps> = ({
  _currentServerNumber,
  onComplete,
  editMode = false,
  controlMachine: _controlMachine,
  isControlPlane,
  nodeNumber,
  defaultValues
}) => {
  const [providerProcess, setProviderProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const { setControlMachine } = useControlMachine();
  const { address } = useWallet();

  // Use shared machine access form logic
  const { isVerifying, error, verifyMachine } = useMachineAccessForm();

  const getDefaultValues = (): Partial<MachineAccess> => {
    if (defaultValues) {
      return {
        hostname: defaultValues.hostname,
        port: defaultValues.port,
        username: defaultValues.username,
        password: defaultValues.password,
        keyfile: defaultValues.keyfile,
        file: defaultValues.file,
        passphrase: defaultValues.passphrase
      };
    }

    if (_currentServerNumber === 0 || !providerProcess?.storeInformation) {
      return {
        hostname: "",
        username: "root",
        port: 22
      };
    }

    const firstServer = providerProcess.machines[0]?.access;
    return {
      hostname: "",
      username: "root",
      port: firstServer?.port,
      password: firstServer?.password || undefined,
      keyfile: firstServer?.keyfile || undefined,
      file: firstServer?.file || undefined,
      passphrase: firstServer?.passphrase || undefined
    };
  };

  const handleSubmit = async (formData: MachineAccess) => {
    try {
      // Use the shared verification logic
      const result = await verifyMachine(formData);

      if (!result) {
        return; // Verification failed
      }

      // Update the machine information as needed
      if (editMode) {
        const machineInfo: MachineInformation = {
          access: {
            hostname: formData.hostname,
            port: formData.port || 22,
            username: formData.username,
            password: formData.password || null,
            file: formData.file || null,
            keyfile: formData.keyfile || null,
            passphrase: formData.passphrase || null
          },
          systemInfo: result.systemInfo
        };

        setControlMachine({
          address,
          ...machineInfo
        });
      } else {
        // Update provider process for the flow
        const machines = [...(providerProcess?.machines ?? [])];

        const machineInfo: MachineInformation = {
          access: {
            hostname: formData.hostname,
            port: formData.port || 22,
            username: formData.username,
            password: formData.password || null,
            file: formData.file || null,
            keyfile: formData.keyfile || null,
            passphrase: formData.passphrase || null
          },
          systemInfo: result.systemInfo
        };

        machines[_currentServerNumber] = machineInfo;

        setProviderProcess({
          ...providerProcess,
          machines,
          storeInformation: _currentServerNumber === 0 ? Boolean(formData.saveInformation) : providerProcess?.storeInformation,
          process: providerProcess.process
        });
      }

      // Call the completion handler
      onComplete(formData);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  return (
    <div className="space-y-6">
      {isControlPlane !== undefined &&
        (isControlPlane ? (
          <Alert>
            <AlertTitle>Control Plane Node {nodeNumber}</AlertTitle>
            <AlertDescription>This node will manage cluster operations and run workloads</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>Worker Node {nodeNumber}</AlertTitle>
            <AlertDescription>This node will run workloads</AlertDescription>
          </Alert>
        ))}

      <MachineAccessForm
        onSubmit={handleSubmit}
        defaultValues={getDefaultValues()}
        submitLabel={editMode ? "Update" : "Next"}
        showSaveConfig={Boolean(_currentServerNumber === 0 && !editMode)}
        isPublicIP={Boolean(_currentServerNumber === 0)}
        disabled={false}
        isVerifying={isVerifying}
        error={error}
      />
    </div>
  );
};
