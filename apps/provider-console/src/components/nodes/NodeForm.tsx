import React, { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@akashnetwork/ui/components";

import { useControlMachine } from "@src/context/ControlMachineProvider";
import restClient from "@src/utils/restClient";
import { MachineAccess, MachineAccessForm } from "../machine/MachineAccessForm";

interface SystemInfo {
  cpus: string;
  memory: string;
  public_ip: string;
  private_ip: string;
  os: string;
  storage: Array<{
    name: string;
    size: number;
    type: string;
    fstype: string | null;
    mountpoint: string | null;
    children?: Array<{
      name: string;
      size: number;
      type: string;
      fstype: string;
      mountpoint: string;
    }>;
  }>;
  gpu: {
    count: number;
    vendor: string | null;
    name: string | null;
    memory_size: string | null;
    interface: string | null;
  };
  has_sudo: boolean;
}

interface NodeInfo {
  access: MachineAccess;
  system_info: SystemInfo;
}

interface NodeFormProps {
  isControlPlane: boolean;
  nodeNumber: number;
  onComplete: (nodeInfo: NodeInfo) => void;
  _defaultValues?: MachineAccess | null;
}

export const NodeForm: React.FC<NodeFormProps> = ({ isControlPlane, nodeNumber, onComplete, _defaultValues }) => {
  const { activeControlMachine } = useControlMachine();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);
  const [formKey, setFormKey] = useState(0); // Add key to force form reset
  const [lastSavedConfig, setLastSavedConfig] = useState<MachineAccess | null>(null);

  const handleSubmit = async (formData: MachineAccess) => {
    if (!activeControlMachine) {
      setError({
        message: "Control machine is not active",
        details: ["Please ensure the control machine is properly configured."]
      });
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // Encode worker node keyfile if it exists
      let workerNodeKeyfile: string | null = null;
      if (formData.keyfile) {
        // If keyfile is already base64 encoded with correct prefix, use it directly
        if (formData.keyfile.startsWith("data:application/octet-stream;base64,")) {
          workerNodeKeyfile = formData.keyfile;
        } else if (formData.keyfile.match(/^[A-Za-z0-9+/=]+$/)) {
          // If it's base64 but missing prefix, add it
          workerNodeKeyfile = `data:application/octet-stream;base64,${formData.keyfile}`;
        } else {
          // Otherwise encode it to base64 with prefix
          workerNodeKeyfile = `data:application/octet-stream;base64,${btoa(formData.keyfile)}`;
        }
      }

      const request = {
        control_machine: {
          hostname: activeControlMachine.access.hostname,
          port: activeControlMachine.access.port || 22,
          username: activeControlMachine.access.username,
          keyfile: activeControlMachine.access.file,
          password: activeControlMachine.access.password || null,
          passphrase: activeControlMachine.access.passphrase || null
        },
        worker_node: {
          hostname: formData.hostname,
          port: formData.port || 22,
          username: formData.username,
          keyfile: workerNodeKeyfile,
          password: formData.password || null,
          passphrase: formData.passphrase || null,
          is_control_plane: isControlPlane
        }
      };

      console.log("Sending verification request:", request);
      const response = await restClient.post("/verify/control-and-worker", request, {
        headers: { "Content-Type": "application/json" }
      });
      console.log("Verification response:", response);

      // Save config if requested
      if (formData.saveInformation) {
        setLastSavedConfig({
          ...formData,
          hostname: "" // Don't save hostname
        });
      } else {
        setLastSavedConfig(null);
      }

      // Call onComplete with the form data and system info
      onComplete({
        access: formData,
        system_info: response.data.system_info
      });

      // Reset form after successful submission
      setFormKey(prev => prev + 1);
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

  // Get default values based on whether previous config should be used
  const getFormDefaults = (): Partial<MachineAccess> => {
    if (lastSavedConfig) {
      return {
        ...lastSavedConfig,
        hostname: "" // Always empty hostname
      };
    }

    return {
      hostname: "", // Always empty hostname
      username: "root", // Keep default username
      port: 22 // Keep default port
    };
  };

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
        defaultValues={getFormDefaults()}
        isVerifying={isVerifying}
        error={error}
        isPublicIP={false}
        showSaveConfig={true}
      />
    </div>
  );
};
