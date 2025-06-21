import { MsgCreateBid } from "@akashnetwork/akash-api/v1beta4";
import type { AkashBlock, Provider, ProviderSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import type { Day } from "@akashnetwork/database/dbSchemas/base/day";
import Long from "long";
import nock from "nock";

import { app, initDb } from "@src/app";
import { closeConnections } from "@src/core";

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
  let providers: Provider[];
  let providerSnapshots: ProviderSnapshot[];
  let day: Day;
  let block: AkashBlock;
  const now = new Date("2025-06-21T00:00:00.000Z");
  const date = "2025-06-21";

  beforeAll(async () => {
    await initDb();

    day = await createDay({
      date,
      aktPrice: 1,
      firstBlockHeight: 1,
      lastBlockHeight: 100,
      lastBlockHeightYet: 100
    });

    providers = await Promise.all([createProvider(), createProvider()]);
    providerSnapshots = await Promise.all([
      createProviderSnapshot({
        owner: providers[0].owner,
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
        owner: providers[1].owner,
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

    const providerSnapshotNodes = await Promise.all([
      createProviderSnapshotNode({
        snapshotId: providerSnapshots[0].id,
        name: "GPU 1",
        gpuAllocatable: 2,
        gpuAllocated: 1
      }),
      createProviderSnapshotNode({
        snapshotId: providerSnapshots[0].id,
        name: "GPU 2",
        gpuAllocatable: 4,
        gpuAllocated: 2
      }),
      createProviderSnapshotNode({
        snapshotId: providerSnapshots[1].id,
        name: "GPU 3",
        gpuAllocatable: 8,
        gpuAllocated: 4
      }),
      createProviderSnapshotNode({
        snapshotId: providerSnapshots[1].id,
        name: "GPU 4",
        gpuAllocatable: 16,
        gpuAllocated: 8
      })
    ]);

    await Promise.all([
      createProviderSnapshotNodeGpu({
        snapshotNodeId: providerSnapshotNodes[0].id,
        vendor: "vendor0",
        name: "gpu0",
        modelId: "model0",
        interface: "interface0",
        memorySize: 1024
      }),
      createProviderSnapshotNodeGpu({
        snapshotNodeId: providerSnapshotNodes[1].id,
        vendor: "vendor0",
        name: "gpu1",
        modelId: "model1",
        interface: "interface1",
        memorySize: 2048
      }),
      createProviderSnapshotNodeGpu({
        snapshotNodeId: providerSnapshotNodes[2].id,
        vendor: "vendor1",
        name: "gpu2",
        modelId: "model2",
        interface: "interface2",
        memorySize: 4096
      }),
      createProviderSnapshotNodeGpu({
        snapshotNodeId: providerSnapshotNodes[3].id,
        vendor: "vendor1",
        name: "gpu3",
        modelId: "model3",
        interface: "interface3",
        memorySize: 8192
      })
    ]);

    await Promise.all([
      providers[0].update({
        lastSuccessfulSnapshotId: providerSnapshots[0].id
      }),
      providers[1].update({
        lastSuccessfulSnapshotId: providerSnapshots[1].id
      })
    ]);

    block = await createAkashBlock({
      dayId: day.id,
      datetime: now,
      height: 100
    });
  });

  afterAll(async () => {
    await closeConnections();
  });

  describe("GET /v1/gpu", () => {
    const expectedVendors = {
      vendor0: [
        {
          model: "gpu0",
          ram: "1024",
          interface: "interface0",
          allocatable: 2,
          allocated: 1
        },
        {
          model: "gpu1",
          ram: "2048",
          interface: "interface1",
          allocatable: 4,
          allocated: 2
        }
      ],
      vendor1: [
        {
          model: "gpu2",
          ram: "4096",
          interface: "interface2",
          allocatable: 8,
          allocated: 4
        },
        {
          model: "gpu3",
          ram: "8192",
          interface: "interface3",
          allocatable: 16,
          allocated: 8
        }
      ]
    };

    it(`returns GPU data with no filters`, async () => {
      const response = await app.request(`/v1/gpu`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gpus.total.allocatable).toBe(30);
      expect(data.gpus.total.allocated).toBe(15);
      expect(data.gpus.details).toEqual(expectedVendors);
    });

    it(`returns GPU data when filtering by vendor`, async () => {
      const response = await app.request(`/v1/gpu?vendor=vendor0`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gpus.total.allocatable).toBe(6);
      expect(data.gpus.total.allocated).toBe(3);
      expect(data.gpus.details).toEqual({
        vendor0: expectedVendors.vendor0
      });
    });

    it(`returns GPU data when filtering by model`, async () => {
      const response = await app.request(`/v1/gpu?model=gpu0`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gpus.total.allocatable).toBe(2);
      expect(data.gpus.total.allocated).toBe(1);
      expect(data.gpus.details).toEqual({
        vendor0: [expectedVendors.vendor0[0]]
      });
    });

    it(`returns GPU data when filtering by memory size`, async () => {
      const response = await app.request(`/v1/gpu?memory_size=2048`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gpus.total.allocatable).toBe(4);
      expect(data.gpus.total.allocated).toBe(2);
      expect(data.gpus.details).toEqual({
        vendor0: [expectedVendors.vendor0[1]]
      });
    });

    it(`returns GPU data when filtering by provider address`, async () => {
      const response = await app.request(`/v1/gpu?provider=${providers[0].owner}`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gpus.total.allocatable).toBe(6);
      expect(data.gpus.total.allocated).toBe(3);
      expect(data.gpus.details).toEqual({
        vendor0: expectedVendors.vendor0
      });
    });

    it(`returns GPU data when filtering by provider hostURI`, async () => {
      const response = await app.request(`/v1/gpu?provider=${providers[1].hostUri}`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.gpus.total.allocatable).toBe(24);
      expect(data.gpus.total.allocated).toBe(12);
      expect(data.gpus.details).toEqual({
        vendor1: expectedVendors.vendor1
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
      const response = await app.request(`/v1/gpu-breakdown`);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toEqual([
        {
          date: `${date}T00:00:00.000Z`,
          vendor: "vendor0",
          model: "gpu0",
          providerCount: 1,
          nodeCount: 1,
          totalGpus: 1,
          leasedGpus: 1,
          gpuUtilization: "100.00"
        },
        {
          date: `${date}T00:00:00.000Z`,
          vendor: "vendor0",
          model: "gpu1",
          providerCount: 1,
          nodeCount: 1,
          totalGpus: 1,
          leasedGpus: 1,
          gpuUtilization: "100.00"
        },
        {
          date: `${date}T00:00:00.000Z`,
          vendor: "vendor1",
          model: "gpu2",
          providerCount: 1,
          nodeCount: 1,
          totalGpus: 1,
          leasedGpus: 1,
          gpuUtilization: "100.00"
        },
        {
          date: `${date}T00:00:00.000Z`,
          vendor: "vendor1",
          model: "gpu3",
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
    beforeAll(async () => {
      const deployments = await Promise.all([
        createDeployment({
          owner: providers[0].owner,
          createdHeight: block.height,
          dseq: Long.fromNumber(1).toString()
        }),
        createDeployment({
          owner: providers[1].owner,
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

      const transactions = await Promise.all([
        createTransaction({
          height: block.height
        }),
        createTransaction({
          height: block.height
        })
      ]);
      await Promise.all([
        createAkashMessage({
          type: "/akash.market.v1beta4.MsgCreateBid",
          txId: transactions[0].id,
          height: block.height,
          data: MsgCreateBid.encode(
            MsgCreateBid.create({
              order: {
                owner: providers[0].owner,
                dseq: Long.fromNumber(1),
                oseq: 1,
                gseq: 1
              },
              provider: providers[0].owner,
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
                          key: "vendor/vendor0/model/gpu0/ram/1024/interface/interface0",
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
          type: "/akash.market.v1beta4.MsgCreateBid",
          txId: transactions[1].id,
          height: block.height,
          data: MsgCreateBid.encode(
            MsgCreateBid.create({
              order: {
                owner: providers[1].owner,
                dseq: Long.fromNumber(2),
                oseq: 1,
                gseq: 1
              },
              provider: providers[1].owner,
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
                          key: "vendor/vendor1/model/gpu3/ram/8192/interface/interface3",
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
    });

    it("returns GPU pricing information", async () => {
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
            vendor: "vendor0",
            model: "gpu0",
            ram: "1024",
            interface: "interface0",
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
              min: 0.58,
              max: 0.58,
              avg: 0.58,
              weightedAverage: 0.58,
              med: 0.58
            }
          },
          {
            vendor: "vendor0",
            model: "gpu1",
            ram: "2048",
            interface: "interface1",
            availability: {
              total: 4,
              available: 2
            },
            providerAvailability: {
              total: 1,
              available: 1
            },
            price: null
          },
          {
            vendor: "vendor1",
            model: "gpu2",
            ram: "4096",
            interface: "interface2",
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
            vendor: "vendor1",
            model: "gpu3",
            ram: "8192",
            interface: "interface3",
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
              min: 1.17,
              max: 1.17,
              avg: 1.17,
              weightedAverage: 1.17,
              med: 1.17
            }
          }
        ]
      });
    });
  });
});
