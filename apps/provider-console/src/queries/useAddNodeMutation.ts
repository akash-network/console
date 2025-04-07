import { type ToasterToast, useToast } from "@akashnetwork/ui/hooks";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { useControlMachine } from "@src/context/ControlMachineProvider";
import { KubeNode } from "@src/types/kubeNode";
import { ServerAccess } from "@src/types/server";
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
    }
  >;
}

export const useAddNodeMutation = () => {
  const { activeControlMachine } = useControlMachine();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError<{ message?: string }>, { nodes: Array<ServerAccess & { isControlPlane: boolean }>; existingNodes: KubeNode[] }>({
    mutationFn: async ({ nodes, existingNodes }) => {
      if (!activeControlMachine) {
        throw new Error("Control machine is not active");
      }

      try {
        const request: AddNodesRequest = {
          control_machine: {
            hostname: activeControlMachine.access.hostname,
            port: activeControlMachine.access.port,
            username: activeControlMachine.access.username,
            keyfile: typeof activeControlMachine.access.file === "string" ? activeControlMachine.access.file : null,
            password: activeControlMachine.access.password,
            passphrase: activeControlMachine.access.passphrase
          },
          existing_nodes: existingNodes,
          nodes: nodes.map(node => ({
            ...node,
            is_control_plane: node.isControlPlane
          }))
        };

        await restClient.post("/kube/add-nodes", request);
      } catch (error) {
        return handleMutationError(error as AxiosError<{ message?: string }>, toast, "Failed to add nodes");
      }
    },
    onSuccess: () => {
      toast({
        title: "Nodes added successfully",
        description: "The new nodes have been added to your cluster."
      });
      // Invalidate the nodes query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: ["kubeNodes"] });
    }
  });
};
