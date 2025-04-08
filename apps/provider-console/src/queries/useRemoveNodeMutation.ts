import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";

import type { ControlMachineWithAddress } from "@src/types/controlMachine";
import type { KubeNode } from "@src/types/kubeNode";
import restClient from "@src/utils/restClient";
import { sanitizeMachineAccess } from "@src/utils/sanityUtils";

/**
 * Response from the node removal API
 */
interface RemoveNodeResponse {
  message: string;
  action_id: string;
}

/**
 * Parameters for removing a node from the Kubernetes cluster
 */
interface RemoveNodeParams {
  /**
   * Node information to remove
   */
  node: KubeNode;

  /**
   * Control machine information
   */
  controlMachine: ControlMachineWithAddress;
}

/**
 * Hook for removing a node from the Kubernetes cluster
 */
export const useRemoveNodeMutation = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<RemoveNodeResponse, Error, RemoveNodeParams>({
    mutationFn: async ({ node, controlMachine }: RemoveNodeParams) => {
      const request = {
        control_machine: sanitizeMachineAccess(controlMachine),
        node: {
          internal_ip: node.internalIP,
          name: node.name,
          type: ["control-plane", "etcd", "master"].some(role => node.roles.toLowerCase().includes(role)) ? "control_plane_node" : "worker_node"
        }
      };

      // restClient's interceptor already extracts response.data
      const result: RemoveNodeResponse = await restClient.post("/kube/remove-node", request);
      return result;
    },
    onSuccess: data => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["kubeNodes"] });
      queryClient.invalidateQueries({ queryKey: ["kubePods"] });

      // Redirect to activity logs with the action ID
      if (data.action_id) {
        router.push(`/activity-logs/${data.action_id}`);
      }
    }
  });
};
