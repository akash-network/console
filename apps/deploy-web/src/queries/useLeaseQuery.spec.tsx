import { useCertificate } from "@src/context/CertificateProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useSettings } from "@src/context/SettingsProvider";
import { useScopedFetchProviderUrl } from "@src/hooks/useScopedFetchProviderUrl";
import type { DeploymentGroup, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { loadWithPagination } from "@src/utils/apiUtils";
import { leaseToDto } from "@src/utils/deploymentDetailUtils";
import { setupQuery } from "../../tests/unit/query-client";
import { queryClient } from "./queryClient";
import { QueryKeys } from "./queryKeys";
import { useAllLeases, useDeploymentLeaseList, useLeaseStatus } from "./useLeaseQuery";

import { waitFor } from "@testing-library/react";

jest.mock("@src/context/SettingsProvider");
jest.mock("@src/context/ServicesProvider");
jest.mock("@src/context/CertificateProvider");
jest.mock("@src/hooks/useScopedFetchProviderUrl");
jest.mock("@src/utils/apiUtils", () => ({
  ...jest.requireActual("@src/utils/apiUtils"),
  loadWithPagination: jest.fn()
}));

const mockSettings = {
  apiEndpoint: "http://test-api.com"
};

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

const mockCert = {
  certPem: "cert",
  keyPem: "key"
};

describe("useLeaseQuery", () => {
  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  describe("useDeploymentLeaseList", () => {
    beforeEach(() => {
      (useSettings as jest.Mock).mockReturnValue({ settings: mockSettings });
      (loadWithPagination as jest.Mock).mockResolvedValue(mockLeases);
    });

    it("should return null when deployment is not provided", async () => {
      const { result } = setupQuery(() => useDeploymentLeaseList("test-address", null));

      await waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("should fetch leases when deployment is provided", async () => {
      const { result } = setupQuery(() => useDeploymentLeaseList("test-address", mockDeployment));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(loadWithPagination).toHaveBeenCalledWith(expect.stringContaining(mockDeployment.dseq), "leases", 1000);
      expect(result.current.data).toEqual([leaseToDto(mockLeases[0], mockDeployment)]);
    });

    it("should provide a remove function that clears the query", async () => {
      const { result } = setupQuery(() => useDeploymentLeaseList("test-address", mockDeployment));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const queryKey = QueryKeys.getLeasesKey("test-address", mockDeployment.dseq);

      const queriesBefore = queryClient.getQueryCache().findAll({ queryKey });
      expect(queriesBefore).toHaveLength(1);

      result.current.remove();

      const queriesAfter = queryClient.getQueryCache().findAll({ queryKey });
      expect(queriesAfter).toHaveLength(0);
    });
  });

  describe("useAllLeases", () => {
    const mockAxios = {
      get: jest.fn()
    };

    beforeEach(() => {
      (useSettings as jest.Mock).mockReturnValue({ settings: mockSettings });
      (useServices as jest.Mock).mockReturnValue({ axios: mockAxios });
      (loadWithPagination as jest.Mock).mockResolvedValue(mockLeases);
    });

    it("should return null when address is not provided", async () => {
      const { result } = setupQuery(() => useAllLeases(""));

      await waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("should fetch all leases when address is provided", async () => {
      const { result } = setupQuery(() => useAllLeases("test-address"));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(loadWithPagination).toHaveBeenCalledWith(expect.stringContaining("test-address"), "leases", 1000, mockAxios);
      expect(result.current.data).toEqual([leaseToDto(mockLeases[0], undefined as any)]);
    });

    it("should use the correct query key", async () => {
      const { result } = setupQuery(() => useAllLeases("test-address"));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.findAll();
      expect(queries[0].queryKey).toContain("ALL_LEASES");
      expect(queries[0].queryKey).toContain("test-address");
    });
  });

  describe("useLeaseStatus", () => {
    const mockProvider: ApiProviderList = {
      owner: "test-owner",
      name: "test-provider",
      hostUri: "http://provider.com",
      createdHeight: 1000,
      email: "test@provider.com",
      website: "https://provider.com",
      lastCheckDate: new Date(),
      deploymentCount: 0,
      leaseCount: 0,
      cosmosSdkVersion: "1.0.0",
      akashVersion: "1.0.0",
      ipRegion: "test-region",
      ipRegionCode: "TR",
      ipCountry: "test-country",
      ipCountryCode: "TC",
      ipLat: "0",
      ipLon: "0",
      uptime1d: 100,
      uptime7d: 100,
      uptime30d: 100,
      isValidVersion: true,
      isOnline: true,
      lastOnlineDate: new Date().toISOString(),
      isAudited: true,
      gpuModels: [],
      activeStats: { cpu: 0, gpu: 0, memory: 0, storage: 0 },
      pendingStats: { cpu: 0, gpu: 0, memory: 0, storage: 0 },
      availableStats: { cpu: 0, gpu: 0, memory: 0, storage: 0 },
      stats: {
        cpu: { active: 0, available: 0, pending: 0 },
        gpu: { active: 0, available: 0, pending: 0 },
        memory: { active: 0, available: 0, pending: 0 },
        storage: {
          ephemeral: { active: 0, available: 0, pending: 0 },
          persistent: { active: 0, available: 0, pending: 0 }
        }
      },
      attributes: [],
      host: "test-host",
      organization: "test-org",
      statusPage: "https://status.provider.com",
      locationRegion: "test-region",
      country: "test-country",
      city: "test-city",
      timezone: "UTC",
      locationType: "datacenter",
      hostingProvider: "test-hosting",
      hardwareCpu: "test-cpu",
      hardwareCpuArch: "x86_64",
      hardwareGpuVendor: "test-vendor",
      hardwareGpuModels: [],
      hardwareDisk: [],
      featPersistentStorage: true,
      featPersistentStorageType: [],
      hardwareMemory: "test-memory",
      networkProvider: "test-network",
      networkSpeedDown: 1000,
      networkSpeedUp: 1000,
      tier: "test-tier",
      featEndpointCustomDomain: true,
      workloadSupportChia: false,
      workloadSupportChiaCapabilities: [],
      featEndpointIp: true
    };

    beforeEach(() => {
      (useCertificate as jest.Mock).mockReturnValue({ localCert: mockCert });
      (useScopedFetchProviderUrl as jest.Mock).mockReturnValue(jest.fn().mockResolvedValue({ data: mockLeaseStatus }));
    });

    it("should return null when lease is not provided", async () => {
      const { result } = setupQuery(() => useLeaseStatus(mockProvider, undefined));

      await waitFor(() => {
        expect(result.current.data).toBeNull();
      });
    });

    it("should fetch lease status when lease is provided", async () => {
      const { result } = setupQuery(() => useLeaseStatus(mockProvider, mockLease));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(useScopedFetchProviderUrl).toHaveBeenCalledWith(mockProvider);
      expect(result.current.data).toEqual(mockLeaseStatus);
    });
  });
});
