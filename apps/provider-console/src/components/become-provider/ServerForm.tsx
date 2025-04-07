"use client";
import React, { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@akashnetwork/ui/components";
import { useAtom } from "jotai";

import { useControlMachine } from "@src/context/ControlMachineProvider"; // eslint-disable-line import-x/no-cycle
import { useWallet } from "@src/context/WalletProvider";
import providerProcessStore from "@src/store/providerProcessStore";
import type { ControlMachineWithAddress } from "@src/types/controlMachine";
import type { MachineInformation } from "@src/types/machineAccess";
import restClient from "@src/utils/restClient";
import type { MachineAccess } from "../machine/MachineAccessForm";
import { MachineAccessForm } from "../machine/MachineAccessForm";

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
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

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

  const handleSubmit = async (formData: MachineAccess & { saveInformation?: boolean }) => {
    setIsVerifying(true);
    setError(null);

    try {
      console.log("Form data:", formData);

      const port = formData.port || 22;

      // Convert keyfile to base64 if it exists
      let encodedKeyfile: string | null = null;
      if (formData.keyfile) {
        try {
          // If keyfile is already base64 encoded with correct prefix, use it directly
          if (formData.keyfile.startsWith("data:application/octet-stream;base64,")) {
            encodedKeyfile = formData.keyfile;
          } else if (formData.keyfile.match(/^[A-Za-z0-9+/=]+$/)) {
            // If it's base64 but missing prefix, add it
            encodedKeyfile = `data:application/octet-stream;base64,${formData.keyfile}`;
          } else {
            // Otherwise encode it to base64 with prefix
            encodedKeyfile = `data:application/octet-stream;base64,${btoa(formData.keyfile)}`;
          }
        } catch (error) {
          console.error("Error encoding keyfile:", error);
          setError({
            message: "Failed to process keyfile",
            details: ["The keyfile content could not be encoded properly. Please check the file format."]
          });
          setIsVerifying(false);
          return;
        }
      }

      const response = await restClient.post(
        "/verify/control-machine",
        {
          hostname: formData.hostname,
          port,
          username: formData.username,
          password: formData.password || null,
          keyfile: encodedKeyfile,
          passphrase: formData.passphrase || null
        },
        {
          headers: { "Content-Type": "application/json" }
        }
      );

      console.log("Server response:", response);

      if (response?.status?.toString().toLowerCase() === "success") {
        const machineInfo: MachineInformation = {
          access: {
            hostname: formData.hostname,
            port,
            username: formData.username,
            password: formData.password || null,
            file: formData.file || null,
            keyfile: formData.keyfile || null,
            passphrase: formData.passphrase || null
          },
          systemInfo: response.data.system_info
        };

        if (editMode) {
          setControlMachine({
            address,
            ...machineInfo
          });
        } else {
          const machines = [...(providerProcess?.machines ?? [])];
          machines[_currentServerNumber] = machineInfo;

          setProviderProcess({
            ...providerProcess,
            machines,
            storeInformation: _currentServerNumber === 0 ? Boolean(formData.saveInformation) : providerProcess?.storeInformation,
            process: providerProcess.process
          });
        }

        onComplete(formData);
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      console.error("Error response:", error.response?.data);

      setError({
        message: "Failed to verify server access",
        details: [error.response?.data?.detail?.error?.message || error.message || "Please check your credentials and try again."]
      });
    } finally {
      setIsVerifying(false);
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
