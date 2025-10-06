import { MsgCreateBid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { ProviderSnapshotNodeGPU } from "@akashnetwork/database/dbSchemas/akash";
import type { Provider } from "@akashnetwork/database/dbSchemas/akash";
import type { ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash/providerSnapshot";
import type { ProviderSnapshotNode } from "@akashnetwork/database/dbSchemas/akash/providerSnapshotNode";
import type { Day } from "@akashnetwork/database/dbSchemas/base/day";
import type { Transaction } from "@akashnetwork/database/dbSchemas/base/transaction";
import { faker } from "@faker-js/faker";
import { format, setHours, setMinutes, setSeconds } from "date-fns";
import Long from "long";
import nock from "nock";

import { closeConnections } from "@src/core";
import type { ListGpuResponse } from "@src/gpu/http-schemas/gpu.schema";
import { app, initDb } from "@src/rest-app";

import {
  createAkashBlock,
  createAkashMessage,
  createDay,
  createDeployment,
  createDeploymentGroup,
  createDeploymentGroupResource,
  createProvider,
  createProviderSnapshot,
  createProviderSnapshotNode,
  createProviderSnapshotNodeGpu,
  createTransaction
} from "@test/seeders";

describe("GPU API", () => {
  const now = setSeconds(setMinutes(setHours(new Date(), 12), 0), 0);
  const date = format(now, "yyyy-MM-dd");

  afterAll(async () => {
    await closeConnections();
    nock.cleanAll();
  });

  describe("GET /v1/gpu", () => {
    it(`returns GPU data with no filters`, async () => {
      const { expectedVendors } = await setup();

      const response = await app.request(`/v1/gpu`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as ListGpuResponse;

      expect(data.gpus.total.allocatable).toBe(30);
      expect(data.gpus.total.allocated).toBe(15);
      expect(data.gpus.details).toEqual(expectedVendors);
    });

    it(`returns GPU data when filtering by vendor`, async () => {
      const { expectedVendors } = await setup();

      const response = await app.request(`/v1/gpu?vendor=nvidia`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as ListGpuResponse;

      expect(data.gpus.total.allocatable).toBe(6);
      expect(data.gpus.total.allocated).toBe(3);
      expect(data.gpus.details).toEqual({
        nvidia: expectedVendors?.nvidia
      });
    });

    it(`returns GPU data when filtering by model`, async () => {
      const { expectedVendors } = await setup();

      const response = await app.request(`/v1/gpu?model=gpu0`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as ListGpuResponse;

      expect(data.gpus.total.allocatable).toBe(2);
      expect(data.gpus.total.allocated).toBe(1);
      expect(data.gpus.details).toEqual({
        nvidia: [expectedVendors?.nvidia[0]]
      });
    });

    it(`returns GPU data when filtering by memory size`, async () => {
      const { expectedVendors } = await setup();

      const response = await app.request(`/v1/gpu?memory_size=2048`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as ListGpuResponse;

      expect(data.gpus.total.allocatable).toBe(4);
      expect(data.gpus.total.allocated).toBe(2);
      expect(data.gpus.details).toEqual({
        nvidia: [expectedVendors?.nvidia[1]]
      });
    });

    it(`returns GPU data when filtering by provider address`, async () => {
      const { providers, expectedVendors } = await setup();

      const response = await app.request(`/v1/gpu?provider=${providers?.[0].owner}`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as ListGpuResponse;

      expect(data.gpus.total.allocatable).toBe(6);
      expect(data.gpus.total.allocated).toBe(3);
      expect(data.gpus.details).toEqual({
        nvidia: expectedVendors?.nvidia
      });
    });

    it(`returns GPU data when filtering by provider hostURI`, async () => {
      const { providers, expectedVendors } = await setup();

      const response = await app.request(`/v1/gpu?provider=${providers?.[1].hostUri}`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as ListGpuResponse;

      expect(data.gpus.total.allocatable).toBe(24);
      expect(data.gpus.total.allocated).toBe(12);
      expect(data.gpus.details).toEqual({
        amd: expectedVendors?.amd
      });
    });
  });

  describe("GET /v1/gpu-models", () => {
    it("returns GPU model data", async () => {
      nock("https://raw.githubusercontent.com")
        .get("/akash-network/provider-configs/main/devices/pcie/gpus.json")
        .reply(200, {
          "10de": {
            name: "nvidia",
            devices: {
              "2235": {
                name: "a40",
                interface: "PCIe",
                memory_size: "48Gi"
              },
              "20b1": {
                name: "a100",
                interface: "PCIe",
                memory_size: "40Gi"
              },
              "20f1": {
                name: "a100",
                interface: "PCIe",
                memory_size: "40Gi"
              }
            }
          },
          "1002": {
            name: "amd",
            devices: {
              "66a1": {
                name: "mi60",
                interface: "PCIe",
                memory_size: "32Gi"
              },
              "738c": {
                name: "mi100",
                interface: "PCIe",
                memory_size: "32Gi"
              }
            }
          }
        });

      const response = await app.request(`/v1/gpu-models`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual([
        {
          name: "amd",
          models: [
            {
              name: "mi60",
              memory: ["32Gi"],
              interface: ["pcie"]
            },
            {
              name: "mi100",
              memory: ["32Gi"],
              interface: ["pcie"]
            }
          ]
        },
        {
          name: "nvidia",
          models: [
            {
              name: "a40",
              memory: ["48Gi"],
              interface: ["pcie"]
            },
            {
              name: "a100",
              memory: ["40Gi"],
              interface: ["pcie"]
            }
          ]
        }
      ]);
    });
  });

  describe("GET /v1/gpu-breakdown", () => {
    it("returns GPU breakdown data", async () => {
      await setup();

      const response = await app.request(`/v1/gpu-breakdown`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual([
        {
          date: `${date}T00:00:00.000Z`,
          vendor: "amd",
          model: "gpu2",
          providerCount: 1,
          nodeCount: 1,
          totalGpus: 1,
          leasedGpus: 1,
          gpuUtilization: "100.00"
        },
        {
          date: `${date}T00:00:00.000Z`,
          vendor: "amd",
          model: "gpu3",
          providerCount: 1,
          nodeCount: 1,
          totalGpus: 1,
          leasedGpus: 1,
          gpuUtilization: "100.00"
        },
        {
          date: `${date}T00:00:00.000Z`,
          vendor: "nvidia",
          model: "gpu0",
          providerCount: 1,
          nodeCount: 1,
          totalGpus: 1,
          leasedGpus: 1,
          gpuUtilization: "100.00"
        },
        {
          date: `${date}T00:00:00.000Z`,
          vendor: "nvidia",
          model: "gpu1",
          providerCount: 1,
          nodeCount: 1,
          totalGpus: 1,
          leasedGpus: 1,
          gpuUtilization: "100.00"
        }
      ]);
    });
  });

  describe("GET /v1/gpu-prices", () => {
    it("returns GPU pricing information", async () => {
      await setup();

      const response = await app.request(`/v1/gpu-prices`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual({
        availability: {
          total: 30,
          available: 15
        },
        models: [
          {
            vendor: "amd",
            model: "gpu2",
            ram: "4096",
            interface: "pcie",
            availability: {
              total: 8,
              available: 4
            },
            providerAvailability: {
              total: 1,
              available: 1
            },
            price: null
          },
          {
            vendor: "amd",
            model: "gpu3",
            ram: "8192",
            interface: "sxm",
            availability: {
              total: 16,
              available: 8
            },
            providerAvailability: {
              total: 1,
              available: 1
            },
            price: {
              currency: "USD",
              min: 1.2,
              max: 1.2,
              avg: 1.2,
              weightedAverage: 1.2,
              med: 1.2
            }
          },
          {
            vendor: "nvidia",
            model: "gpu0",
            ram: "1024",
            interface: "pcie",
            availability: {
              total: 2,
              available: 1
            },
            providerAvailability: {
              total: 1,
              available: 1
            },
            price: {
              currency: "USD",
              min: 0.6,
              max: 0.6,
              avg: 0.6,
              weightedAverage: 0.6,
              med: 0.6
            }
          },
          {
            vendor: "nvidia",
            model: "gpu1",
            ram: "2048",
            interface: "sxm",
            availability: {
              total: 4,
              available: 2
            },
            providerAvailability: {
              total: 1,
              available: 1
            },
            price: null
          }
        ]
      });
    });
  });

  const testData: {
    day?: Day;
    providers?: Provider[];
    providerSnapshots?: ProviderSnapshot[];
    providerSnapshotNodes?: ProviderSnapshotNode[];
    providerSnapshotNodeGpus?: ProviderSnapshotNodeGPU[];
    expectedVendors?: Record<
      string,
      {
        model: string;
        ram: string;
        interface: string;
        allocatable: number;
        allocated: number;
      }[]
    >;
    transactions?: Transaction[];
  } = {};
  let isDbInitialized = false;

  async function setup() {
    if (isDbInitialized) {
      return testData;
    }

    await initDb();

    testData.day = await createDay({
      date,
      aktPrice: 1,
      firstBlockHeight: 1,
      lastBlockHeight: 100,
      lastBlockHeightYet: 100
    });

    testData.providers = await Promise.all([
      createProvider({
        isOnline: true
      }),
      createProvider({
        isOnline: true
      })
    ]);
    testData.providerSnapshots = await Promise.all([
      createProviderSnapshot({
        owner: testData.providers[0].owner,
        checkDate: now,
        isOnline: true,
        isLastSuccessOfDay: true,
        activeCPU: 101,
        activeGPU: 102,
        activeMemory: 103,
        activePersistentStorage: 104,
        activeEphemeralStorage: 105,
        pendingCPU: 106,
        pendingGPU: 107,
        pendingMemory: 108,
        pendingPersistentStorage: 109,
        pendingEphemeralStorage: 110,
        availableCPU: 111,
        availableGPU: 112,
        availableMemory: 113,
        availablePersistentStorage: 114,
        availableEphemeralStorage: 115
      }),
      createProviderSnapshot({
        owner: testData.providers[1].owner,
        checkDate: now,
        isOnline: true,
        isLastSuccessOfDay: true,
        activeCPU: 201,
        activeGPU: 202,
        activeMemory: 203,
        activePersistentStorage: 204,
        activeEphemeralStorage: 205,
        pendingCPU: 206,
        pendingGPU: 207,
        pendingMemory: 208,
        pendingPersistentStorage: 209,
        pendingEphemeralStorage: 210,
        availableCPU: 211,
        availableGPU: 212,
        availableMemory: 213,
        availablePersistentStorage: 214,
        availableEphemeralStorage: 215
      })
    ]);

    testData.providerSnapshotNodes = await Promise.all([
      createProviderSnapshotNode({
        snapshotId: testData.providerSnapshots[0].id,
        name: "GPU 1",
        gpuAllocatable: 2,
        gpuAllocated: 1
      }),
      createProviderSnapshotNode({
        snapshotId: testData.providerSnapshots[0].id,
        name: "GPU 2",
        gpuAllocatable: 4,
        gpuAllocated: 2
      }),
      createProviderSnapshotNode({
        snapshotId: testData.providerSnapshots[1].id,
        name: "GPU 3",
        gpuAllocatable: 8,
        gpuAllocated: 4
      }),
      createProviderSnapshotNode({
        snapshotId: testData.providerSnapshots[1].id,
        name: "GPU 4",
        gpuAllocatable: 16,
        gpuAllocated: 8
      })
    ]);

    testData.providerSnapshotNodeGpus = await Promise.all([
      createProviderSnapshotNodeGpu({
        snapshotNodeId: testData.providerSnapshotNodes[0].id,
        vendor: "nvidia",
        name: "gpu0",
        modelId: faker.string.alpha(10),
        interface: "pcie",
        memorySize: 1024
      }),
      createProviderSnapshotNodeGpu({
        snapshotNodeId: testData.providerSnapshotNodes[1].id,
        vendor: "nvidia",
        name: "gpu1",
        modelId: faker.string.alpha(10),
        interface: "sxm",
        memorySize: 2048
      }),
      createProviderSnapshotNodeGpu({
        snapshotNodeId: testData.providerSnapshotNodes[2].id,
        vendor: "amd",
        name: "gpu2",
        modelId: faker.string.alpha(10),
        interface: "pcie",
        memorySize: 4096
      }),
      createProviderSnapshotNodeGpu({
        snapshotNodeId: testData.providerSnapshotNodes[3].id,
        vendor: "amd",
        name: "gpu3",
        modelId: faker.string.alpha(10),
        interface: "sxm",
        memorySize: 8192
      })
    ]);

    testData.expectedVendors = {
      nvidia: [
        {
          model: testData.providerSnapshotNodeGpus[0].name,
          ram: "1024",
          interface: testData.providerSnapshotNodeGpus[0].interface,
          allocatable: 2,
          allocated: 1
        },
        {
          model: testData.providerSnapshotNodeGpus[1].name,
          ram: "2048",
          interface: testData.providerSnapshotNodeGpus[1].interface,
          allocatable: 4,
          allocated: 2
        }
      ],
      amd: [
        {
          model: testData.providerSnapshotNodeGpus[2].name,
          ram: "4096",
          interface: testData.providerSnapshotNodeGpus[2].interface,
          allocatable: 8,
          allocated: 4
        },
        {
          model: testData.providerSnapshotNodeGpus[3].name,
          ram: "8192",
          interface: testData.providerSnapshotNodeGpus[3].interface,
          allocatable: 16,
          allocated: 8
        }
      ]
    };

    await Promise.all([
      testData.providers[0].update({
        lastSuccessfulSnapshotId: testData.providerSnapshots[0].id
      }),
      testData.providers[1].update({
        lastSuccessfulSnapshotId: testData.providerSnapshots[1].id
      })
    ]);

    const block = await createAkashBlock({
      dayId: testData.day.id,
      datetime: now,
      height: 100
    });

    const deployments = await Promise.all([
      createDeployment({
        owner: testData.providers[0].owner,
        createdHeight: block.height,
        dseq: Long.fromNumber(1).toString()
      }),
      createDeployment({
        owner: testData.providers[1].owner,
        createdHeight: block.height,
        dseq: Long.fromNumber(2).toString()
      })
    ]);
    const deploymentGroups = await Promise.all([
      createDeploymentGroup({
        deploymentId: deployments[0].id
      }),
      createDeploymentGroup({
        deploymentId: deployments[1].id
      })
    ]);
    await Promise.all([
      createDeploymentGroupResource({
        deploymentGroupId: deploymentGroups[0].id,
        gpuUnits: 1
      }),
      createDeploymentGroupResource({
        deploymentGroupId: deploymentGroups[1].id,
        gpuUnits: 1
      })
    ]);

    testData.transactions = await Promise.all([
      createTransaction({
        height: block.height
      }),
      createTransaction({
        height: block.height
      })
    ]);
    await Promise.all([
      createAkashMessage({
        type: `/${MsgCreateBid.$type}`,
        txId: testData.transactions[0].id,
        height: block.height,
        data: MsgCreateBid.encode(
          MsgCreateBid.create({
            id: {
              owner: testData.providers[0].owner,
              dseq: Long.fromNumber(1),
              oseq: 1,
              gseq: 1,
              provider: testData.providers[0].owner
            },
            price: {
              amount: "1000",
              denom: "uakt"
            },
            resourcesOffer: [
              {
                resources: {
                  cpu: {
                    units: {
                      val: Buffer.from("1000000")
                    }
                  },
                  memory: {
                    quantity: {
                      val: Buffer.from("1024")
                    }
                  },
                  storage: [
                    {
                      quantity: {
                        val: Buffer.from("1024")
                      }
                    }
                  ],
                  gpu: {
                    attributes: [
                      {
                        key: `vendor/nvidia/model/gpu0/ram/1024/interface/pcie`,
                        value: "true"
                      }
                    ],
                    units: {
                      val: Buffer.from("2")
                    }
                  }
                }
              }
            ]
          })
        ).finish(),
        relatedDeploymentId: deployments[0].id
      }),
      createAkashMessage({
        type: `/${MsgCreateBid.$type}`,
        txId: testData.transactions[1].id,
        height: block.height,
        data: MsgCreateBid.encode(
          MsgCreateBid.create({
            id: {
              owner: testData.providers[1].owner,
              dseq: Long.fromNumber(2),
              oseq: 1,
              gseq: 1,
              provider: testData.providers[1].owner
            },
            price: {
              amount: "2000",
              denom: "uakt"
            },
            resourcesOffer: [
              {
                resources: {
                  cpu: {
                    units: {
                      val: Buffer.from("1000000")
                    }
                  },
                  memory: {
                    quantity: {
                      val: Buffer.from("1024")
                    }
                  },
                  storage: [
                    {
                      quantity: {
                        val: Buffer.from("1024")
                      }
                    }
                  ],
                  gpu: {
                    attributes: [
                      {
                        key: "vendor/amd/model/gpu3/ram/8192/interface/sxm",
                        value: "true"
                      }
                    ],
                    units: {
                      val: Buffer.from("2")
                    }
                  }
                }
              }
            ]
          })
        ).finish(),
        relatedDeploymentId: deployments[1].id
      })
    ]);

    isDbInitialized = true;

    return testData;
  }
});
