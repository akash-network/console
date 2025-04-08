import { type ToasterToast, useToast } from "@akashnetwork/ui/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useRouter } from "next/router";

import { useControlMachine } from "@src/context/ControlMachineProvider";
import { KubeNode } from "@src/types/kubeNode";
import { ServerAccess } from "@src/types/server";
import { processKeyfile } from "@src/utils/nodeVerification";
import restClient from "@src/utils/restClient";

// Define ToastParameters type locally
type ToastParameters = Omit<ToasterToast, "id">;

const handleMutationError = (error: AxiosError<{ message?: string }>, toast: (props: ToastParameters) => void, message: string) => {
  const errorMessage = error.response?.data?.message || error.message || "An error occurred";
  toast({
    variant: "destructive",
    title: message,
    description: errorMessage
  });
  throw error;
};

interface AddNodesRequest {
  control_machine: {
    hostname: string;
    port: number;
    username: string;
    keyfile?: string | null;
    password?: string | null;
    passphrase?: string | null;
  };
  existing_nodes: KubeNode[];
  nodes: Array<
    ServerAccess & {
      is_control_plane: boolean;
      install_gpu_drivers: boolean;
    }
  >;
}

interface AddNodesResponse {
  message: string;
  action_id: string;
}

export const useAddNodeMutation = () => {
  const { activeControlMachine } = useControlMachine();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<
    AddNodesResponse,
    AxiosError<{ message?: string }>,
    {
      nodes: Array<ServerAccess & { isControlPlane: boolean; installGpuDrivers?: boolean }>;
      existingNodes: KubeNode[];
    }
  >({
    mutationFn: async ({ nodes, existingNodes }) => {
      if (!activeControlMachine) {
        throw new Error("Control machine is not active");
      }

      try {
        // Use keyfile directly - thanks to our migration, it should be available
        const request: AddNodesRequest = {
          control_machine: {
            hostname: activeControlMachine.access.hostname,
            port: activeControlMachine.access.port || 22,
            username: activeControlMachine.access.username,
            keyfile: activeControlMachine.access.keyfile,
            password: activeControlMachine.access.password,
            passphrase: activeControlMachine.access.passphrase
          },
          existing_nodes: existingNodes,
          nodes: nodes.map(node => {
            // Create a clean node object with only the properties needed for the API
            const cleanNode = {
              hostname: node.hostname,
              port: node.port,
              username: node.username,
              is_control_plane: node.isControlPlane,
              install_gpu_drivers: node.installGpuDrivers || false
            };

            // Add optional properties only if they exist
            // Process keyfile to ensure it has the proper data prefix format
            if (node.keyfile) {
              cleanNode["keyfile"] = processKeyfile(node.keyfile);
            }
            if (node.password) cleanNode["password"] = node.password;
            if (node.passphrase) cleanNode["passphrase"] = node.passphrase;

            return cleanNode;
          })
        };

        console.log(
          "AddNodeMutation - Final node hostnames:",
          request.nodes.map(n => n.hostname)
        );
        console.log("Sending request with nodes:", request.nodes.length);
        const response: { message: string; action_id: string } = await restClient.post("/kube/add-nodes", request);
        return response;
      } catch (error) {
        return handleMutationError(error as AxiosError<{ message?: string }>, toast, "Failed to add nodes");
      }
    },
    onSuccess: data => {
      toast({
        title: "Nodes adding process started",
        description: "You'll be redirected to the activity logs page to monitor progress."
      });

      // Navigate to the activity logs page to track the node adding process
      if (data?.action_id) {
        router.push(`/activity-logs/${data.action_id}`);
      } else {
        console.error("No action_id received in the response");
      }

      // Invalidate the nodes query to refetch the updated list when user returns
      queryClient.invalidateQueries({ queryKey: ["kubeNodes"] });
    }
  });
};
