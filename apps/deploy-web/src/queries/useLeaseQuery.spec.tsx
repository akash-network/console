import type { CertificatesService } from "@akashnetwork/http-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Props as ServicesProviderProps } from "@src/context/ServicesProvider";
import type { UseProviderCredentialsResult } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { FallbackableHttpClient } from "@src/services/createFallbackableHttpClient/createFallbackableHttpClient";
import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { leaseToDto } from "@src/utils/deploymentDetailUtils";
import { setupQuery } from "../../tests/unit/query-client";
import { QueryKeys } from "./queryKeys";
import { USE_LEASE_STATUS_DEPENDENCIES, useAllLeases, useDeploymentLeaseList, useLeaseStatus } from "./useLeaseQuery";

import { act } from "@testing-library/react";
import { buildProvider } from "@tests/seeders/provider";

const mockDeployment = {
  dseq: "123",
  groups: []
};

const mockLeases = [
  {
    lease: {
      id: {
        owner: "test-owner",
        dseq: "123",
        gseq: 1,
        oseq: 1,
        provider: "provider1",
        bseq: 1
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
      id: {
        aid: {
          scope: "test-scope",
          xid: "test-xid"
        },
        xid: "test-payment-id"
      },
      state: {
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
        unsettled: {
          denom: "uakt",
          amount: "0"
        },
        withdrawn: {
          denom: "uakt",
          amount: "0"
        }
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
  id: {
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
          chainApiHttpClient: () => mock<FallbackableHttpClient>()
        }
      });

      await vi.waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("should fetch leases when deployment is provided", async () => {
      const chainApiHttpClient = mock<FallbackableHttpClient>({
        get: vi.fn().mockResolvedValue({
          data: {
            leases: mockLeases,
            pagination: { next_key: null, total: mockLeases.length }
          }
        })
      } as unknown as FallbackableHttpClient);
      const { result } = setupQuery(() => useDeploymentLeaseList("test-address", mockDeployment), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(chainApiHttpClient.get).toHaveBeenCalledWith(expect.stringContaining(`filters.dseq=${mockDeployment.dseq}`));
      expect(result.current.data).toEqual([leaseToDto(mockLeases[0], mockDeployment)]);
    });

    it("should provide a remove function that clears the query", async () => {
      const chainApiHttpClient = mock<FallbackableHttpClient>({
        get: vi.fn().mockResolvedValue({
          data: {
            leases: mockLeases,
            pagination: { next_key: null, total: mockLeases.length }
          }
        })
      } as unknown as FallbackableHttpClient);
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

      await vi.waitFor(() => {
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
          chainApiHttpClient: () => mock<FallbackableHttpClient>()
        }
      });

      await vi.waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("should fetch all leases when address is provided", async () => {
      const chainApiHttpClient = mock<FallbackableHttpClient>({
        get: vi.fn().mockResolvedValue({
          data: {
            leases: mockLeases,
            pagination: { next_key: null, total: mockLeases.length }
          }
        })
      } as unknown as FallbackableHttpClient);
      const { result } = setupQuery(() => useAllLeases("test-address"), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(chainApiHttpClient.get).toHaveBeenCalledWith(expect.stringContaining("filters.owner=test-address"));
      expect(result.current.data).toEqual([leaseToDto(mockLeases[0], undefined as any)]);
    });

    it("should use the correct query key", async () => {
      const chainApiHttpClient = mock<FallbackableHttpClient>({
        get: vi.fn().mockResolvedValue({
          data: {
            leases: mockLeases,
            pagination: { next_key: null, total: mockLeases.length }
          }
        })
      } as unknown as FallbackableHttpClient);
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

      await vi.waitFor(() => {
        expect(result.current.leases.isSuccess).toBe(true);
      });
      const queryCache = result.current.queryClient.getQueryCache();
      const queries = queryCache.findAll();
      expect(queries[0].queryKey).toContain("ALL_LEASES");
      expect(queries[0].queryKey).toContain("test-address");
    });
  });

  describe("useLeaseStatus", () => {
    it("returns null when lease is not provided", async () => {
      const { result } = setupLeaseStatus();

      await vi.waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("returns null when local cert is not provided", async () => {
      const { result } = setupLeaseStatus({
        lease: mockLease,
        providerCredentials: {
          type: "mtls",
          value: null,
          isExpired: false,
          usable: false
        },
        services: {
          providerProxy: () => mock<ProviderProxyService>()
        }
      });

      await vi.waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("returns null when lease is not active", async () => {
      const { result } = setupLeaseStatus({
        lease: { ...mockLease, state: "closed" },
        services: {
          providerProxy: () => mock<ProviderProxyService>()
        }
      });
      await vi.waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("returns null when fetching lease status fails with 404", async () => {
      const providerProxy = mock<ProviderProxyService>({
        request: vi.fn().mockRejectedValue(new AxiosError("Not Found", "404", undefined, undefined, { status: 404 } as any))
      });
      const { result } = setupLeaseStatus({
        lease: mockLease,
        services: {
          providerProxy: () => providerProxy
        }
      });
      await vi.waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("fetches lease status when certificate is provided", async () => {
      const provider = buildProvider();
      const providerProxy = mock<ProviderProxyService>({
        request: vi.fn().mockResolvedValue({ data: mockLeaseStatus })
      });
      const { result } = setupLeaseStatus({
        provider,
        lease: mockLease,
        providerCredentials: {
          type: "mtls",
          value: {
            cert: "certPem",
            key: "keyPem"
          },
          isExpired: false,
          usable: true
        },
        services: {
          providerProxy: () => providerProxy
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(providerProxy.request).toHaveBeenCalledWith(
        expect.stringContaining(`/lease/${mockLease.dseq}/${mockLease.gseq}/${mockLease.oseq}/status`),
        expect.objectContaining({
          method: "GET",
          providerIdentity: provider
        })
      );
      expect(result.current.data).toEqual(mockLeaseStatus);
    });

    function setupLeaseStatus(input?: {
      provider?: ApiProviderList;
      lease?: LeaseDto;
      providerCredentials?: UseProviderCredentialsResult["details"];
      services?: ServicesProviderProps["services"];
    }) {
      const dependencies: typeof USE_LEASE_STATUS_DEPENDENCIES = {
        ...USE_LEASE_STATUS_DEPENDENCIES,
        useProviderCredentials: () => ({
          details: input?.providerCredentials ?? {
            type: "mtls",
            value: {
              cert: "certPem",
              key: "keyPem"
            },
            isExpired: false,
            usable: true
          },
          generate: vi.fn(async () => {})
        })
      };
      return setupQuery(() => useLeaseStatus({ provider: input?.provider || buildProvider(), lease: input?.lease, dependencies }), {
        services: {
          providerProxy: () => mock<ProviderProxyService>(),
          certificatesService: () => mock<CertificatesService>(),
          ...input?.services
        }
      });
    }
  });
});
