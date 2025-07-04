import type { CertificatesService } from "@akashnetwork/http-sdk";
import { useQueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import { mock } from "jest-mock-extended";

import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import { leaseToDto } from "@src/utils/deploymentDetailUtils";
import { setupQuery } from "../../tests/unit/query-client";
import { QueryKeys } from "./queryKeys";
import { useAllLeases, useDeploymentLeaseList, useLeaseStatus } from "./useLeaseQuery";

import { act, waitFor } from "@testing-library/react";
import { buildProvider } from "@tests/seeders/provider";

const mockDeployment = {
  dseq: "123",
  groups: []
};

const mockLeases = [
  {
    lease: {
      lease_id: {
        owner: "test-owner",
        dseq: "123",
        gseq: 1,
        oseq: 1,
        provider: "provider1"
      },
      state: "active",
      price: {
        amount: "1000",
        denom: "uakt"
      },
      created_at: new Date().toISOString(),
      closed_on: ""
    },
    escrow_payment: {
      account_id: {
        scope: "test-scope",
        xid: "test-xid"
      },
      payment_id: "test-payment-id",
      owner: "test-owner",
      state: "active",
      rate: {
        denom: "uakt",
        amount: "1000"
      },
      balance: {
        denom: "uakt",
        amount: "1000"
      },
      withdrawn: {
        denom: "uakt",
        amount: "0"
      }
    }
  }
];

const mockLeaseStatus = {
  forwarded_ports: {},
  ips: {},
  services: {}
};

const mockGroup: DeploymentGroup = {
  group_id: {
    owner: "test-owner",
    dseq: "123",
    gseq: 1
  },
  state: "active",
  group_spec: {
    name: "test-group",
    requirements: {
      signed_by: {
        all_of: [],
        any_of: []
      },
      attributes: []
    },
    resources: []
  },
  created_at: new Date().toISOString()
};

const mockLease: LeaseDto = {
  id: "test-lease-id",
  owner: "test-owner",
  provider: "test-provider",
  dseq: "123",
  gseq: 1,
  oseq: 1,
  state: "active",
  price: {
    denom: "uakt",
    amount: "1000"
  },
  cpuAmount: 1,
  gpuAmount: 0,
  memoryAmount: 1024,
  storageAmount: 1024,
  group: mockGroup
};

describe("useLeaseQuery", () => {
  describe("useDeploymentLeaseList", () => {
    it("should return null when deployment is not provided", async () => {
      const { result } = setupQuery(() => useDeploymentLeaseList("test-address", null), {
        services: {
          chainApiHttpClient: () => mock<AxiosInstance>()
        }
      });

      await waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("should fetch leases when deployment is provided", async () => {
      const chainApiHttpClient = mock<AxiosInstance>({
        defaults: { baseURL: "http://localhost" },
        get: jest.fn().mockResolvedValue({
          data: {
            leases: mockLeases,
            pagination: { next_key: null, total: mockLeases.length }
          }
        })
      } as unknown as AxiosInstance);
      const { result } = setupQuery(() => useDeploymentLeaseList("test-address", mockDeployment), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient
        }
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(chainApiHttpClient.get).toHaveBeenCalledWith(expect.stringContaining(`filters.dseq=${mockDeployment.dseq}`));
      expect(result.current.data).toEqual([leaseToDto(mockLeases[0], mockDeployment)]);
    });

    it("should provide a remove function that clears the query", async () => {
      const chainApiHttpClient = mock<AxiosInstance>({
        defaults: { baseURL: "http://localhost" },
        get: jest.fn().mockResolvedValue({
          data: {
            leases: mockLeases,
            pagination: { next_key: null, total: mockLeases.length }
          }
        })
      } as unknown as AxiosInstance);
      const { result } = setupQuery(
        () => {
          const deploymentList = useDeploymentLeaseList("test-address", mockDeployment);
          const queryClient = useQueryClient();
          return { deploymentList, queryClient };
        },
        {
          services: {
            chainApiHttpClient: () => chainApiHttpClient
          }
        }
      );

      await waitFor(() => {
        expect(result.current.deploymentList.isSuccess).toBe(true);
      });

      const queryKey = QueryKeys.getLeasesKey("test-address", mockDeployment.dseq);

      const queriesBefore = result.current.queryClient.getQueryCache().findAll({ queryKey });
      expect(queriesBefore).toHaveLength(1);

      act(() => {
        result.current.deploymentList.remove();
      });

      const queriesAfter = result.current.queryClient.getQueryCache().findAll({ queryKey });
      expect(queriesAfter).toHaveLength(0);
    });
  });

  describe("useAllLeases", () => {
    it("should return null when address is not provided", async () => {
      const { result } = setupQuery(() => useAllLeases(""), {
        services: {
          chainApiHttpClient: () => mock<AxiosInstance>()
        }
      });

      await waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("should fetch all leases when address is provided", async () => {
      const chainApiHttpClient = mock<AxiosInstance>({
        get: jest.fn().mockResolvedValue({
          data: {
            leases: mockLeases,
            pagination: { next_key: null, total: mockLeases.length }
          }
        })
      } as unknown as AxiosInstance);
      const { result } = setupQuery(() => useAllLeases("test-address"), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient
        }
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(chainApiHttpClient.get).toHaveBeenCalledWith(expect.stringContaining("filters.owner=test-address"));
      expect(result.current.data).toEqual([leaseToDto(mockLeases[0], undefined as any)]);
    });

    it("should use the correct query key", async () => {
      const chainApiHttpClient = mock<AxiosInstance>({
        get: jest.fn().mockResolvedValue({
          data: {
            leases: mockLeases,
            pagination: { next_key: null, total: mockLeases.length }
          }
        })
      } as unknown as AxiosInstance);
      const { result } = setupQuery(
        () => {
          const leases = useAllLeases("test-address");
          const queryClient = useQueryClient();
          return { leases, queryClient };
        },
        {
          services: {
            chainApiHttpClient: () => chainApiHttpClient
          }
        }
      );

      await waitFor(() => {
        expect(result.current.leases.isSuccess).toBe(true);
      });
      const queryCache = result.current.queryClient.getQueryCache();
      const queries = queryCache.findAll();
      expect(queries[0].queryKey).toContain("ALL_LEASES");
      expect(queries[0].queryKey).toContain("test-address");
    });
  });

  describe("useLeaseStatus", () => {
    it("should return null when lease is not provided", async () => {
      const { result } = setupQuery(() => useLeaseStatus(buildProvider(), undefined), {
        services: {
          providerProxy: () => mock<ProviderProxyService>(),
          certificatesService: () => mock<CertificatesService>()
        }
      });

      await waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("should fetch lease status when lease is provided", async () => {
      const provider = buildProvider();
      const providerProxy = mock<ProviderProxyService>({
        fetchProviderUrl: jest.fn().mockResolvedValue({ data: mockLeaseStatus })
      });
      const { result } = setupQuery(() => useLeaseStatus(provider, mockLease), {
        services: {
          providerProxy: () => providerProxy,
          certificatesService: () => mock<CertificatesService>()
        }
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(providerProxy.fetchProviderUrl).toHaveBeenCalledWith(
        expect.stringContaining(`/lease/${mockLease.dseq}/${mockLease.gseq}/${mockLease.oseq}/status`),
        expect.objectContaining({
          method: "GET",
          providerIdentity: provider
        })
      );
      expect(result.current.data).toEqual(mockLeaseStatus);
    });
  });
});
