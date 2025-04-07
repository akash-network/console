import { type ToasterToast, useToast } from "@akashnetwork/ui/hooks";
import { useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { useControlMachine } from "@src/context/ControlMachineProvider";
import { KubeNodesResponse } from "@src/types/kubeNode";
import restClient from "@src/utils/restClient";
import { sanitizeMachineAccess } from "@src/utils/sanityUtils";

// Define ToastParameters type locally
type ToastParameters = Omit<ToasterToast, "id">;

// Define handleQueryError locally
const handleQueryError = (error: AxiosError, toast: (props: ToastParameters) => unknown, customMessage?: string, customTitle = "Please try again") => {
  toast({
    variant: "destructive",
    title: customTitle,
    description: customMessage || "There was a problem with your request."
  });

  throw error;
};

export const useKubeNodesQuery = () => {
  const { activeControlMachine } = useControlMachine();
  const { toast } = useToast();

  return useQuery<KubeNodesResponse, AxiosError>({
    queryKey: ["kubeNodes", activeControlMachine?.address],
    queryFn: async () => {
      if (!activeControlMachine) {
        throw new Error("Control machine is not active");
      }
      try {
        const request = {
          control_machine: sanitizeMachineAccess(activeControlMachine)
        };
        const responseData = await restClient.post("/kube/nodes", request);
        // Cast via unknown to satisfy TypeScript
        return responseData as unknown as KubeNodesResponse;
      } catch (error) {
        return handleQueryError(error as AxiosError, toast, "Failed to fetch Kubernetes nodes");
      }
    },
    enabled: !!activeControlMachine,
    refetchOnWindowFocus: false,
    retry: 3
  });
};
