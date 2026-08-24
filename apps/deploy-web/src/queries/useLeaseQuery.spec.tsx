import type { LeaseHttpService } from "@akashnetwork/http-sdk";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Props as ServicesProviderProps } from "@src/context/ServicesProvider";
import type { UseProviderCredentialsResult } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { FallbackableHttpClient } from "@src/services/createFallbackableHttpClient/createFallbackableHttpClient";
import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import { isProviderUnavailableError } from "@src/services/query-error-policy/query-error-policy";
import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { leaseToDto } from "@src/utils/deploymentDetailUtils";
import { setupQuery } from "../../tests/unit/query-client";
import { QueryKeys } from "./queryKeys";
import {
  type LeaseServiceStatusResponse,
  type LeaseStatusDto,
  type LeaseStatusResponse,
  normalizeLeaseStatus,
  USE_LEASE_STATUS_DEPENDENCIES,
  useAllLeases,
  useDeploymentLeaseList,
  useLeaseExistenceQuery,
  useLeaseStatus,
  useLeaseStatuses
} from "./useLeaseQuery";

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

const mockClosedLeases = [
  {
    ...mockLeases[0],
    lease: {
      ...mockLeases[0].lease,
      state: "closed"
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

    it("keeps a closed deployment's lease list fresh after the first fetch", async () => {
      const { result, chainApiHttpClient } = setup({ state: "closed", leases: mockClosedLeases });

      await vi.waitFor(() => {
        expect(result.current.leases.isSuccess).toBe(true);
      });

      const query = result.current.queryClient.getQueryCache().find({
        queryKey: QueryKeys.getLeasesKey("test-address", mockDeployment.dseq)
      });

      expect(chainApiHttpClient.get).toHaveBeenCalledTimes(1);
      expect(query?.isStale()).toBe(false);
    });

    it("treats an active deployment's lease list as immediately stale", async () => {
      const { result } = setup({ state: "active" });

      await vi.waitFor(() => {
        expect(result.current.leases.isSuccess).toBe(true);
      });

      const query = result.current.queryClient.getQueryCache().find({
        queryKey: QueryKeys.getLeasesKey("test-address", mockDeployment.dseq)
      });

      expect(query?.isStale()).toBe(true);
    });

    it("refetches a closed deployment when the cached lease list still looks live", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false }
        }
      });
      const chainApiHttpClient = mock<FallbackableHttpClient>();
      chainApiHttpClient.get.mockResolvedValue({
        data: {
          leases: mockLeases,
          pagination: { next_key: null, total: mockLeases.length }
        }
      });

      const first = setupQuery(() => useDeploymentLeaseList("test-address", { ...mockDeployment, state: "active" }), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient,
          queryClient: () => queryClient
        }
      });

      await vi.waitFor(() => {
        expect(first.result.current.isSuccess).toBe(true);
      });
      expect(chainApiHttpClient.get).toHaveBeenCalledTimes(1);
      first.unmount();

      const second = setupQuery(() => useDeploymentLeaseList("test-address", { ...mockDeployment, state: "closed" }), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient,
          queryClient: () => queryClient
        }
      });

      await vi.waitFor(() => {
        expect(chainApiHttpClient.get).toHaveBeenCalledTimes(2);
      });
      second.unmount();
    });

    function setup(input: { state?: string; leases?: typeof mockLeases }) {
      const rpcLeases = input.leases ?? mockLeases;
      const chainApiHttpClient = mock<FallbackableHttpClient>();
      chainApiHttpClient.get.mockResolvedValue({
        data: {
          leases: rpcLeases,
          pagination: { next_key: null, total: rpcLeases.length }
        }
      });
      const { result } = setupQuery(
        () => {
          const leases = useDeploymentLeaseList("test-address", { ...mockDeployment, state: input.state });
          const queryClient = useQueryClient();
          return { leases, queryClient };
        },
        {
          services: {
            chainApiHttpClient: () => chainApiHttpClient
          }
        }
      );

      return { result, chainApiHttpClient };
    }
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
      expect(chainApiHttpClient.get).toHaveBeenCalledWith(expect.not.stringContaining("filters.state="));
      expect(result.current.data).toEqual([leaseToDto(mockLeases[0], undefined as any)]);
    });

    it("requests only the given lease state when one is provided", async () => {
      const chainApiHttpClient = mock<FallbackableHttpClient>({
        get: vi.fn().mockResolvedValue({
          data: {
            leases: mockLeases,
            pagination: { next_key: null, total: mockLeases.length }
          }
        })
      } as unknown as FallbackableHttpClient);
      const { result } = setupQuery(() => useAllLeases("test-address", { state: "active" }), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      const requestedUrl = chainApiHttpClient.get.mock.calls[0][0] as string;
      expect(requestedUrl).toContain("filters.owner=test-address");
      expect(requestedUrl).toContain("filters.state=active");
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
      expect(queries[0].queryKey).not.toContain("active");
    });

    it("requests each given lease state when several are provided", async () => {
      const chainApiHttpClient = mock<FallbackableHttpClient>({
        get: vi.fn().mockResolvedValue({
          data: {
            leases: mockLeases,
            pagination: { next_key: null, total: mockLeases.length }
          }
        })
      } as unknown as FallbackableHttpClient);
      const { result } = setupQuery(() => useAllLeases("test-address", { state: ["active", "reclaiming"] }), {
        services: {
          chainApiHttpClient: () => chainApiHttpClient
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      const requestedUrls = chainApiHttpClient.get.mock.calls.map(call => call[0] as string);
      expect(requestedUrls).toEqual(
        expect.arrayContaining([expect.stringContaining("filters.state=active"), expect.stringContaining("filters.state=reclaiming")])
      );
      expect(requestedUrls).toHaveLength(2);
    });

    it("keys a state-filtered list separately from the unfiltered list", async () => {
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
          const leases = useAllLeases("test-address", { state: "active" });
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
      expect(result.current.queryClient.getQueryCache().findAll()[0].queryKey).toEqual(["ALL_LEASES", "test-address", "active"]);
    });

    it("keys a multi-state list separately from a single-state list", async () => {
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
          const leases = useAllLeases("test-address", { state: ["active", "reclaiming"] });
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
      expect(result.current.queryClient.getQueryCache().findAll()[0].queryKey).toEqual(["ALL_LEASES", "test-address", "active,reclaiming"]);
    });
  });

  describe("useLeaseExistenceQuery", () => {
    it("returns true when the address has at least one lease", async () => {
      const { result } = setupLeaseExistence({ hasLeases: true });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toBe(true);
    });

    it("returns false when the address has no leases", async () => {
      const { result } = setupLeaseExistence({ hasLeases: false });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toBe(false);
    });

    it("asks the lease service about the queried address", async () => {
      const { result, leaseHttpService } = setupLeaseExistence({ hasLeases: true });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(leaseHttpService.hasLeases).toHaveBeenCalledWith("test-address");
    });

    it("keys under the all-leases prefix so deploy-success invalidation refreshes it", () => {
      const allLeasesKey = QueryKeys.getAllLeasesKey("test-address");

      expect(QueryKeys.getLeaseExistenceKey("test-address").slice(0, allLeasesKey.length)).toEqual(allLeasesKey);
    });

    function setupLeaseExistence(input: { hasLeases: boolean }) {
      const leaseHttpService = mock<LeaseHttpService>();
      leaseHttpService.hasLeases.mockResolvedValue(input.hasLeases);
      const { result } = setupQuery(() => useLeaseExistenceQuery("test-address"), {
        services: {
          leaseHttpService: () => leaseHttpService
        }
      });
      return { result, leaseHttpService };
    }
  });

  describe("useLeaseStatus", () => {
    it("returns null when lease is not provided", async () => {
      const { result } = setupLeaseStatus();

      await vi.waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("returns null when JWT is not usable", async () => {
      const { result } = setupLeaseStatus({
        lease: mockLease,
        providerCredentials: {
          type: "jwt",
          value: null,
          isExpired: false,
          usable: false,
          error: null
        },
        services: {
          providerProxy: () => mock<ProviderProxyService>()
        }
      });

      await vi.waitFor(() => {
        expect(result.current.data).toBeFalsy();
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

    it("returns null when the provider proxy cannot be reached", async () => {
      const providerProxy = mock<ProviderProxyService>({
        request: vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
      });
      const { result } = setupLeaseStatus({
        lease: mockLease,
        services: {
          providerProxy: () => providerProxy
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
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

    it.each([502, 503])("surfaces a %s from the provider proxy as a provider-unavailable error", async status => {
      const providerProxy = mock<ProviderProxyService>({
        request: vi.fn().mockRejectedValue(new AxiosError("Unavailable", String(status), undefined, undefined, { status } as any))
      });
      const { result } = setupLeaseStatus({
        lease: mockLease,
        services: {
          providerProxy: () => providerProxy
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(isProviderUnavailableError(result.current.error)).toBe(true);
      expect(providerProxy.request).toHaveBeenCalledTimes(1);
    });

    it("fetches lease status when a JWT is available", async () => {
      const provider = buildProvider();
      const providerProxy = mock<ProviderProxyService>({
        request: vi.fn().mockResolvedValue({ data: mockLeaseStatus })
      });
      const { result } = setupLeaseStatus({
        provider,
        lease: mockLease,
        providerCredentials: {
          type: "jwt",
          value: "jwt-token",
          isExpired: false,
          usable: true,
          error: null
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

    it("filters the attestation sidecar out of the returned services", async () => {
      const provider = buildProvider();
      const statusWithSidecar = {
        forwarded_ports: {},
        ips: {},
        services: {
          web: { name: "web", available: 1 },
          "akash-attestation-sidecar": { name: "akash-attestation-sidecar", available: 1 }
        }
      };
      const providerProxy = mock<ProviderProxyService>({
        request: vi.fn().mockResolvedValue({ data: statusWithSidecar })
      });
      const { result } = setupLeaseStatus({
        provider,
        lease: mockLease,
        services: {
          providerProxy: () => providerProxy
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.services).toHaveProperty("web");
      expect(result.current.data?.services).not.toHaveProperty("akash-attestation-sidecar");
    });

    it("composes a caller-provided select on top of the sidecar filter", async () => {
      const statusWithSidecar = {
        forwarded_ports: {},
        ips: {},
        services: {
          web: { name: "web", available: 1 },
          "akash-attestation-sidecar": { name: "akash-attestation-sidecar", available: 1 }
        }
      };
      const providerProxy = mock<ProviderProxyService>({
        request: vi.fn().mockResolvedValue({ data: statusWithSidecar })
      });
      const callerSelect = vi.fn((data: LeaseStatusDto | null) => data);
      const { result } = setupLeaseStatus({
        lease: mockLease,
        select: callerSelect,
        services: {
          providerProxy: () => providerProxy
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const receivedServices = callerSelect.mock.calls[0][0]?.services ?? {};
      expect(receivedServices).toHaveProperty("web");
      expect(receivedServices).not.toHaveProperty("akash-attestation-sidecar");
    });

    it("fetches status for two live leases in parallel, keyed by gseq", async () => {
      const provider = buildProvider();
      const leaseA = { ...mockLease, id: "lease-a", gseq: 1 };
      const leaseB = { ...mockLease, id: "lease-b", gseq: 2 };
      const providerProxy = mock<ProviderProxyService>({
        request: vi.fn().mockImplementation((url: string) => {
          if (url.includes("/lease/123/1/1/status")) {
            return Promise.resolve({ data: { services: { web: { name: "web", available: 1, uris: ["web.example"] } }, forwarded_ports: {}, ips: {} } });
          }
          if (url.includes("/lease/123/2/1/status")) {
            return Promise.resolve({ data: { services: { api: { name: "api", available: 1, uris: ["api.example"] } }, forwarded_ports: {}, ips: {} } });
          }
          return Promise.resolve({ data: null });
        })
      });
      const dependencies: typeof USE_LEASE_STATUS_DEPENDENCIES = {
        ...USE_LEASE_STATUS_DEPENDENCIES,
        useProviderCredentials: () => ({
          details: { type: "jwt", value: "jwt-token", isExpired: false, usable: true, error: null },
          ensureToken: vi.fn().mockResolvedValue("jwt-token")
        })
      };

      const { result } = setupQuery(
        () => ({
          first: useLeaseStatus({ provider, lease: leaseA, dependencies }),
          second: useLeaseStatus({ provider, lease: leaseB, dependencies })
        }),
        { services: { providerProxy: () => providerProxy } }
      );

      await vi.waitFor(() => {
        expect(result.current.first.isSuccess).toBe(true);
        expect(result.current.second.isSuccess).toBe(true);
      });

      expect(result.current.first.data?.services.web?.uris).toEqual(["web.example"]);
      expect(result.current.second.data?.services.api?.uris).toEqual(["api.example"]);
      expect(providerProxy.request).toHaveBeenCalledWith(expect.stringContaining("/lease/123/1/1/status"), expect.anything());
      expect(providerProxy.request).toHaveBeenCalledWith(expect.stringContaining("/lease/123/2/1/status"), expect.anything());
    });

    it("useLeaseStatuses fetches every live lease", async () => {
      const provider = buildProvider();
      const leaseA = { ...mockLease, id: "lease-a", gseq: 1 };
      const leaseB = { ...mockLease, id: "lease-b", gseq: 2 };
      const providerProxy = mock<ProviderProxyService>({
        request: vi.fn().mockImplementation((url: string) => {
          if (url.includes("/lease/123/1/1/status")) {
            return Promise.resolve({ data: { services: { web: { name: "web", available: 1, uris: ["web.example"] } }, forwarded_ports: {}, ips: {} } });
          }
          if (url.includes("/lease/123/2/1/status")) {
            return Promise.resolve({ data: { services: { api: { name: "api", available: 1, uris: ["api.example"] } }, forwarded_ports: {}, ips: {} } });
          }
          return Promise.resolve({ data: null });
        })
      });
      const dependencies: typeof USE_LEASE_STATUS_DEPENDENCIES = {
        ...USE_LEASE_STATUS_DEPENDENCIES,
        useProviderCredentials: () => ({
          details: { type: "jwt", value: "jwt-token", isExpired: false, usable: true, error: null },
          ensureToken: vi.fn().mockResolvedValue("jwt-token")
        })
      };

      const { result } = setupQuery(
        () =>
          useLeaseStatuses(
            [
              { lease: leaseA, provider },
              { lease: leaseB, provider }
            ],
            { dependencies }
          ),
        { services: { providerProxy: () => providerProxy } }
      );

      await vi.waitFor(() => {
        expect(result.current[0].isSuccess).toBe(true);
        expect(result.current[1].isSuccess).toBe(true);
      });

      expect(result.current[0].data?.services.web?.uris).toEqual(["web.example"]);
      expect(result.current[1].data?.services.api?.uris).toEqual(["api.example"]);
    });

    it("coerces the provider's null endpoint collections to empty arrays", async () => {
      const statusWithNulls = {
        forwarded_ports: { web: null },
        ips: null,
        services: { web: { name: "web", available: 1, uris: null } }
      };
      const providerProxy = mock<ProviderProxyService>({
        request: vi.fn().mockResolvedValue({ data: statusWithNulls })
      });
      const { result } = setupLeaseStatus({
        lease: mockLease,
        services: {
          providerProxy: () => providerProxy
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.services.web.uris).toEqual([]);
      expect(result.current.data?.forwarded_ports.web).toEqual([]);
      expect(result.current.data?.ips).toEqual({});
    });

    function setupLeaseStatus(input?: {
      provider?: ApiProviderList;
      lease?: LeaseDto;
      providerCredentials?: UseProviderCredentialsResult["details"];
      services?: ServicesProviderProps["services"];
      select?: (data: LeaseStatusDto | null) => LeaseStatusDto | null;
    }) {
      const dependencies: typeof USE_LEASE_STATUS_DEPENDENCIES = {
        ...USE_LEASE_STATUS_DEPENDENCIES,
        useProviderCredentials: () => ({
          details: input?.providerCredentials ?? {
            type: "jwt",
            value: "jwt-token",
            isExpired: false,
            usable: true,
            error: null
          },
          ensureToken: vi.fn().mockResolvedValue("jwt-token")
        })
      };
      return setupQuery(() => useLeaseStatus({ provider: input?.provider || buildProvider(), lease: input?.lease, dependencies, select: input?.select }), {
        services: {
          providerProxy: () => mock<ProviderProxyService>(),
          ...input?.services
        }
      });
    }
  });

  describe(normalizeLeaseStatus.name, () => {
    it("keeps the collections a provider already reports as arrays", () => {
      const status = normalizeLeaseStatus({
        forwarded_ports: { web: [{ host: "provider.io", externalPort: 30000, port: 80, available: 1 }] },
        ips: { web: [{ IP: "1.2.3.4", ExternalPort: 8080, Port: 80, Protocol: "TCP" }] },
        services: { web: buildServiceResponse({ uris: ["app.example.com"] }) }
      });

      expect(status.services.web.uris).toEqual(["app.example.com"]);
      expect(status.forwarded_ports.web).toHaveLength(1);
      expect(status.ips.web).toHaveLength(1);
    });

    it("coerces a nil-slice null on each collection to an empty array", () => {
      const status = normalizeLeaseStatus({
        forwarded_ports: { web: null },
        ips: { web: null },
        services: { web: buildServiceResponse({ uris: null }) }
      });

      expect(status.services.web.uris).toEqual([]);
      expect(status.forwarded_ports.web).toEqual([]);
      expect(status.ips.web).toEqual([]);
    });

    it("coerces a nil-map null on each collection to an empty record", () => {
      const status = normalizeLeaseStatus({ forwarded_ports: null, ips: null, services: null });

      expect(status.services).toEqual({});
      expect(status.forwarded_ports).toEqual({});
      expect(status.ips).toEqual({});
    });

    it("keeps a service named __proto__ as an own key rather than reassigning the prototype", () => {
      const services: LeaseStatusResponse["services"] = JSON.parse('{"__proto__":{"name":"__proto__","uris":null}}');

      const status = normalizeLeaseStatus({ forwarded_ports: null, ips: null, services });

      expect(Object.keys(status.services)).toEqual(["__proto__"]);
    });

    function buildServiceResponse(overrides: Partial<LeaseServiceStatusResponse>): LeaseServiceStatusResponse {
      return {
        name: "web",
        available: 1,
        total: 1,
        uris: [],
        observed_generation: 1,
        replicas: 1,
        updated_replicas: 1,
        ready_replicas: 1,
        available_replicas: 1,
        ...overrides
      };
    }
  });
});
