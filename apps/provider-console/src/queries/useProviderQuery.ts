import { type ToasterToast, useToast } from "@akashnetwork/ui/hooks";
import { useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import type { ControlMachineWithAddress } from "@src/types/controlMachine";
import type { DeploymentDetail, ProviderDeployments } from "@src/types/deployment";
import type { ActionList, ActionStatus, PersistentStorageResponse, ProviderDashoard, ProviderDetails, ProviderOnChainStatus } from "@src/types/provider";
import type { GpuPricesResponse } from "@src/types/providerPricing";
import consoleClient from "@src/utils/consoleClient";
import { findTotalAmountSpentOnLeases, totalDeploymentCost, totalDeploymentTimeLeft } from "@src/utils/deploymentUtils";
import restClient from "@src/utils/restClient";
import { sanitizeMachineAccess } from "@src/utils/sanityUtils";

type ToastParameters = Omit<ToasterToast, "id">;

const handleQueryError = (error: AxiosError, toast: (props: ToastParameters) => unknown, customMessage?: string, customTitle = "Please try again") => {
  toast({
    variant: "destructive",
    title: customTitle,
    description: customMessage || "There was a problem with your request."
  });

  throw error;
};

export const useProviderDeployments = (address: string, status: string, currentPage: number, pageSize: number) => {
  const { toast } = useToast();
  return useQuery({
    queryKey: ["providerDeployments", address, status, currentPage, pageSize],
    queryFn: async () => {
      try {
        const offset = (currentPage - 1) * pageSize;
        const response: ProviderDeployments = await consoleClient.get(`v1/providers/${address}/deployments/${offset}/${pageSize}?status=${status}`);
        const latestBlocks = await consoleClient.get(`/v1/blocks`);
        const latestBlock = latestBlocks[0].height;

        const deploymentsWithCost = response.deployments.map(deployment => ({
          ...deployment,
          amountSpent: findTotalAmountSpentOnLeases(deployment.leases, latestBlock),
          costPerMonth: totalDeploymentCost(deployment.leases)
        }));

        return {
          deployments: deploymentsWithCost,
          total: response.total
        };
      } catch (error: unknown) {
        return handleQueryError(error as AxiosError, toast, "Failed to fetch provider deployments");
      }
    },
    retry: (failureCount, error: AxiosError) => {
      const status = error.response?.status;
      if (status && status >= 400 && status < 500) {
        return false;
      }
      return failureCount < 3;
    }
  });
};

export const useDeploymentDetails = (owner: string, dseq: string) => {
  const { toast } = useToast();
  return useQuery({
    queryKey: ["deployment", owner, dseq],
    queryFn: async () => {
      try {
        const response: DeploymentDetail = await consoleClient.get(`v1/deployment/${owner}/${dseq}`);
        const latestBlocks = await consoleClient.get(`/v1/blocks`);
        const latestBlock = latestBlocks[0].height;

        const totalAmtSpent = findTotalAmountSpentOnLeases(response.leases, latestBlock, true);
        const totalCost = totalDeploymentCost(response.leases);
        const timeLeft = totalDeploymentTimeLeft(response.createdHeight, response.totalMonthlyCostUDenom, latestBlock, response.balance, response.closedHeight);

        return {
          ...response,
          amountSpent: totalAmtSpent,
          costPerMonth: totalCost,
          timeLeft: timeLeft
        };
      } catch (error: unknown) {
        return handleQueryError(error as AxiosError, toast, "Failed to fetch deployment details");
      }
    },
    enabled: !!owner && !!dseq
  });
};

export const useProviderDetails = (address: string | undefined) => {
  const { toast } = useToast();
  return useQuery<ProviderDetails>({
    queryKey: ["providerDetails", address],
    queryFn: async () => {
      try {
        return await consoleClient.get(`/v1/providers/${address}`);
      } catch (error: unknown) {
        const axiosError = error as AxiosError;
        // Don't show toast for 404 errors as it's an expected response for non-providers
        if (axiosError.response?.status === 404) {
          throw error;
        }
        return handleQueryError(axiosError, toast, "Failed to fetch provider details");
      }
    },
    refetchOnWindowFocus: false,
    retry: (failureCount, error: AxiosError) => {
      const status = error.response?.status;
      if (status && status >= 400 && status < 500) {
        return false;
      }
      return failureCount < 3;
    },
    enabled: !!address
  });
};

export const useProviderDashboard = (address: string | undefined) => {
  const { toast } = useToast();
  return useQuery<ProviderDashoard>({
    queryKey: ["providerDashboard", address],
    queryFn: async () => {
      try {
        return await consoleClient.get(`/internal/provider-dashboard/${address}`);
      } catch (error: unknown) {
        const axiosError = error as AxiosError;
        // Don't show toast for 404 errors as it's an expected response for non-providers
        if (axiosError.response?.status === 404) {
          throw error;
        }
        return handleQueryError(axiosError, toast, "Failed to fetch provider dashboard");
      }
    },
    refetchOnWindowFocus: false,
    retry: (failureCount, error: AxiosError) => {
      const status = error.response?.status;
      if (status && status >= 400 && status < 500) {
        return false;
      }
      return failureCount < 3;
    },
    enabled: !!address
  });
};

export const useProviderActions = () => {
  const { toast } = useToast();
  return useQuery({
    queryKey: ["providerActions"],
    queryFn: async () => {
      try {
        const response: ActionList = await restClient.get("/actions");
        return response.actions;
      } catch (error: unknown) {
        return handleQueryError(error as AxiosError, toast, "Failed to fetch provider actions");
      }
    },
    refetchOnWindowFocus: false,
    retry: 3
  });
};

export const useProviderActionStatus = (actionId: string | null) => {
  const { toast } = useToast();
  return useQuery<ActionStatus>({
    queryKey: ["providerActionStatus", actionId],
    queryFn: async (): Promise<ActionStatus> => {
      try {
        return await restClient.get(`/action/status/${actionId}`);
      } catch (error: unknown) {
        return handleQueryError(error as AxiosError, toast, "Failed to fetch action status");
      }
    },
    enabled: !!actionId,
    refetchInterval: query => {
      if (query.state.data?.tasks?.some(task => task.status === "in_progress")) {
        return 5000;
      }
      return false;
    },
    placeholderData: previousValue => previousValue,
    refetchOnWindowFocus: query => {
      const data = query.state.data;
      return data?.tasks?.some(task => task.status === "in_progress") ?? false;
    },
    retry: 3
  });
};

export const useProviderStatus = (chainId: string, enabled = true) => {
  const { toast } = useToast();
  return useQuery({
    queryKey: ["providerStatus", chainId],
    queryFn: async () => {
      try {
        const response: ProviderOnChainStatus = await restClient.get(`/provider/status/onchain?chainid=${chainId}`);
        return {
          provider: response.provider
        };
      } catch (error: unknown) {
        return handleQueryError(error as AxiosError, toast, "Failed to fetch provider status");
      }
    },
    enabled: enabled,
    retry: 3
  });
};

export const useProviderOnlineStatus = (providerUri: string | undefined, chainId: string | undefined, enabled = true) => {
  const { toast } = useToast();
  return useQuery({
    queryKey: ["providerOnlineStatus", providerUri, chainId],
    queryFn: async () => {
      if (!providerUri || !chainId) return null;
      try {
        const res: { online: boolean } = await restClient.get(
          `/provider/status/v2/online?provider_uri=${encodeURIComponent(providerUri)}&chainid=${encodeURIComponent(chainId)}`
        );
        return res.online;
      } catch (error: unknown) {
        return handleQueryError(error as AxiosError, toast, "Failed to fetch provider online status");
      }
    },
    enabled: !!providerUri && !!chainId && enabled,
    refetchInterval: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
    retry: 3
  });
};

export const usePersistentStorage = (activeControlMachine: ControlMachineWithAddress | null) => {
  const { toast } = useToast();
  return useQuery<PersistentStorageResponse>({
    queryKey: ["persistentStorage"],
    queryFn: async () => {
      try {
        return await restClient.post(`/get-unformatted-drives`, { control_machine: sanitizeMachineAccess(activeControlMachine) });
      } catch (error: unknown) {
        return handleQueryError(error as AxiosError, toast, "Failed to fetch persistent storage");
      }
    },
    enabled: !!activeControlMachine,
    retry: 3
  });
};

export const useGpuPrices = () => {
  const { toast } = useToast();
  return useQuery<GpuPricesResponse>({
    queryKey: ["gpuPrices"],
    queryFn: async () => {
      try {
        return await consoleClient.get("/v1/gpu-prices");
      } catch (error: unknown) {
        return handleQueryError(error as AxiosError, toast, "Failed to fetch GPU prices");
      }
    },
    refetchOnWindowFocus: false,
    retry: 3,
    // Cache the data for 5 minutes
    staleTime: 5 * 60 * 1000
  });
};
