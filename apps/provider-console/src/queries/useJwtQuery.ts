import { useToast } from "@akashnetwork/ui/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useRouter } from "next/router";

import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { type JwtEnablementFormData, type JwtEnablementResponse, type JwtStatus } from "@src/types/jwt";
import restClient from "@src/utils/restClient";
import { sanitizeMachineAccess } from "@src/utils/sanityUtils";

// Hook to check JWT status
export const useJwtStatus = () => {
  const { activeControlMachine } = useControlMachine();
  const { address } = useSelectedChain();

  return useQuery<JwtStatus>({
    queryKey: ["jwtStatus", address],
    queryFn: async (): Promise<JwtStatus> => {
      if (!activeControlMachine) {
        throw new Error("Control machine not connected");
      }

      try {
        const request = {
          control_machine: sanitizeMachineAccess(activeControlMachine)
        };
        const response = await restClient.post("/letsencrypt-jwt/status", request);
        return response as unknown as JwtStatus;
      } catch (error) {
        console.error("Failed to fetch JWT status:", error);
        throw error;
      }
    },
    enabled: !!activeControlMachine && !!address,
    refetchOnWindowFocus: false,
    retry: (failureCount, error: AxiosError) => {
      const status = error.response?.status;
      if (status && status >= 400 && status < 500) {
        return false;
      }
      return failureCount < 3;
    }
  });
};

// Hook to enable JWT
export const useEnableJwt = () => {
  const { activeControlMachine } = useControlMachine();
  const { address } = useSelectedChain();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: JwtEnablementFormData) => {
      if (!activeControlMachine) {
        throw new Error("Control machine not connected");
      }

      try {
        const request = {
          control_machine: sanitizeMachineAccess(activeControlMachine),
          ...data
        };
        const response = await restClient.post("/letsencrypt-jwt/enable", request);
        return response as unknown as JwtEnablementResponse;
      } catch (error) {
        console.error("Failed to enable JWT:", error);
        throw error;
      }
    },
    onSuccess: response => {
      // Invalidate JWT status query to refresh the status
      queryClient.invalidateQueries({ queryKey: ["jwtStatus", address] });

      // Show success message
      toast({
        title: "Success",
        description: response.message || "JWT enablement started successfully",
        variant: "default"
      });

      // Redirect to activity logs if action_id is provided
      if (response.action_id) {
        router.push(`/activity-logs/${response.action_id}`);
      }
    },
    onError: (error: AxiosError) => {
      console.error("JWT enablement failed:", error);
      const errorMessage = (error.response?.data as { message?: string })?.message || "Failed to enable JWT. Please try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });
};
