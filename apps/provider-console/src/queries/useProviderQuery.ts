import { useQuery } from "react-query";

import { ControlMachineWithAddress } from "@src/types/controlMachine";
import consoleClient from "@src/utils/consoleClient";
import { findTotalAmountSpentOnLeases, totalDeploymentCost, totalDeploymentTimeLeft } from "@src/utils/deploymentUtils";
import restClient from "@src/utils/restClient";
import { sanitizeMachineAccess } from "@src/utils/sanityUtils";

export const useProviderDeployments = (address: string, status: string, currentPage: number, pageSize: number) => {
  return useQuery({
    queryKey: ["providerDeployments", address, status, currentPage, pageSize],
    queryFn: async () => {
      const offset = (currentPage - 1) * pageSize;
      const response: any = await consoleClient.get(`v1/providers/${address}/deployments/${offset}/${pageSize}?status=${status}`);
      const latestBlocks = await consoleClient.get(`/v1/blocks`);
      const latestBlock = latestBlocks[0].height;

      const deploymentsWithCost = response.deployments.map(deployment => {
        const totalCost = totalDeploymentCost(deployment.leases);
        const totalAmtSpent = findTotalAmountSpentOnLeases(deployment.leases, latestBlock);
        return {
          ...deployment,
          amountSpent: totalAmtSpent,
          costPerMonth: totalCost
        };
      });

      return {
        deployments: deploymentsWithCost,
        total: response.total
      };
    },
    enabled: !!address
  });
};

export const useDeploymentDetails = (owner: string, dseq: string) => {
  return useQuery({
    queryKey: ["deployment", owner, dseq],
    queryFn: async () => {
      const [response, latestBlocks]: any = await Promise.all([
        consoleClient.get<any>(`v1/deployment/${owner}/${dseq}`),
        consoleClient.get<any>(`/v1/blocks`)
      ]);

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
    },
    enabled: !!owner && !!dseq
  });
};

export const useProviderDetails = (address: string | undefined) => {
  return useQuery({
    queryKey: ["providerDetails", address],
    queryFn: () => consoleClient.get(`/v1/providers/${address}`),
    refetchOnWindowFocus: false,
    retry: 3,
    enabled: !!address
  });
};

export const useProviderDashboard = (address: string) => {
  return useQuery({
    queryKey: ["providerDashboard", address],
    queryFn: () => consoleClient.get(`/internal/provider-dashboard/${address}`),
    refetchOnWindowFocus: false,
    retry: 3,
    enabled: !!address
  });
};

export const useProviderActions = () => {
  return useQuery({
    queryKey: ["providerActions"],
    queryFn: async () => {
      const response: any = await restClient.get("/actions");
      return response.actions;
    },
    refetchOnWindowFocus: false,
    retry: 3
  });
};

export const useProviderActionStatus = (actionId: string | null) => {
  return useQuery({
    queryKey: ["providerActionStatus", actionId],
    queryFn: () => restClient.get(`/action/status/${actionId}`),
    enabled: !!actionId,
    refetchInterval: (data: any) =>
      data?.status === "completed" || data?.status === "failed" ? false : 5000,
    retry: 3
  });
};

export const useProviderStatus = (chainId: string, enabled = true) => {
  return useQuery({
    queryKey: ["providerStatus", chainId],
    queryFn: async () => {
      const response: any = await restClient.get(`/provider/status/onchain?chainid=${chainId}`);
      return {
        isProvider: response.provider ? true : false,
        provider: response.provider
      };
    },
    enabled: enabled,
    retry: 3
  });
};

export const useProviderOnlineStatus = (chainId: string, isProvider: boolean) => {
  return useQuery({
    queryKey: ["providerOnlineStatus", chainId],
    queryFn: async () => {
      const response: any = await restClient.get(`/provider/status/online?chainid=${chainId}`);
      return response.online;
    },
    enabled: isProvider,
    retry: 3
  });
};

export const usePersistentStorage = (activeControlMachine: ControlMachineWithAddress | null) => {
  return useQuery({
    queryKey: ["persistentStorage"],
    queryFn: () => restClient.post(`/get-unformatted-drives`, { control_machine: sanitizeMachineAccess(activeControlMachine) }),
    enabled: !!activeControlMachine,
    retry: 3
  });
};
