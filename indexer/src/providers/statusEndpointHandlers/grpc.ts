import { Provider, ProviderSnapshot, ProviderSnapshotNode, ProviderSnapshotNodeCPU, ProviderSnapshotNodeGPU } from "@shared/dbSchemas/akash";
import { sequelize } from "@src/db/dbConnection";
import { toUTC } from "@src/shared/utils/date";
import { parseDecimalKubernetesString, parseSizeStr } from "@src/shared/utils/files";
import { isSameDay } from "date-fns";
import { loadFileDescriptorSetFromBuffer } from "@grpc/proto-loader";
import * as fs from "fs";
import * as grpc from "@grpc/grpc-js";

async function queryStatus(hostUri: string, timeout: number) {
  return new Promise((resolve, reject) => {
    try {
      const url = hostUri.replace("https://", "").replace(":8443", ":8444"); // Use 8444 as default GRPC port for now, enventually get from on-chain data

      const grpcClient = new (packageDef as any).akash.provider.v1.ProviderRPC(url, { deadline: Date.now() + timeout }, clientInsecureCreds);

      grpcClient.getStatus({}, (err, response) => {
        console.log("err", err, "response", response);
        if (err) {
          reject(err);
        } else {
          resolve(response);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

const protosetBuffer = fs.readFileSync("./src/proto/gen/descriptor.bin");
const descriptorSet = loadFileDescriptorSetFromBuffer(protosetBuffer);
const packageDef = grpc.loadPackageDefinition(descriptorSet);
const clientInsecureCreds = grpc.credentials.createInsecure();

export async function fetchAndSaveProviderStats(provider: Provider, cosmosSdkVersion: string, version: string, timeout: number) {
  const response = await queryStatus(provider.hostUri, timeout);

  const data = response as NewStatusResponseType;

  const activeResources = sumResources(data.cluster.inventory.reservations.active);
  const pendingResources = sumResources(data.cluster.inventory.reservations.pending);
  const availableResources = data.cluster.inventory.cluster.nodes
    .map((x) => ({
      cpu: parseDecimalKubernetesString(x.resources.cpu.quantity.allocatable.string),
      memory: parseSizeStr(x.resources.memory.quantity.allocatable.string),
      storage: parseSizeStr(x.resources.ephemeralStorage.allocatable.string),
      gpu: parseDecimalKubernetesString(x.resources.gpu.quantity.allocatable.string)
    }))
    .reduce(
      (prev, next) => ({
        cpu: prev.cpu + next.cpu,
        gpu: prev.gpu + next.gpu,
        memory: prev.memory + next.memory,
        storage: prev.storage + next.storage
      }),
      {
        cpu: 0,
        gpu: 0,
        memory: 0,
        storage: 0
      }
    );
  const checkDate = toUTC(new Date());

  console.time("updateData");
  await sequelize.transaction(async (t) => {
    const createdSnapshot = await ProviderSnapshot.create(
      {
        owner: provider.owner,
        isOnline: true,
        checkDate: checkDate,
        isLastOfDay: true,
        deploymentCount: data.manifest.deployments,
        leaseCount: data.cluster.leases.active ?? 0,
        activeCPU: activeResources.cpu,
        activeGPU: activeResources.gpu,
        activeMemory: activeResources.memory,
        activeStorage: activeResources.storage,
        pendingCPU: pendingResources.cpu,
        pendingGPU: pendingResources.gpu,
        pendingMemory: pendingResources.memory,
        pendingStorage: pendingResources.storage,
        availableCPU: availableResources.cpu,
        availableGPU: availableResources.gpu,
        availableMemory: availableResources.memory,
        availableStorage: availableResources.storage
      },
      { transaction: t }
    );

    if (provider.lastSnapshot && isSameDay(provider.lastSnapshot.checkDate, checkDate)) {
      await ProviderSnapshot.update(
        {
          isLastOfDay: false
        },
        {
          where: { id: provider.lastSnapshot.id },
          transaction: t
        }
      );
    }

    await Provider.update(
      {
        lastSnapshotId: createdSnapshot.id,
        isOnline: true,
        error: null,
        lastCheckDate: checkDate,
        cosmosSdkVersion: cosmosSdkVersion,
        akashVersion: version,
        deploymentCount: data.manifest.deployments,
        leaseCount: data.cluster.leases.active ?? 0,
        activeCPU: activeResources.cpu,
        activeGPU: activeResources.gpu,
        activeMemory: activeResources.memory,
        activeStorage: activeResources.storage,
        pendingCPU: pendingResources.cpu,
        pendingGPU: pendingResources.gpu,
        pendingMemory: pendingResources.memory,
        pendingStorage: pendingResources.storage,
        availableCPU: availableResources.cpu,
        availableGPU: availableResources.gpu,
        availableMemory: availableResources.memory,
        availableStorage: availableResources.storage
      },
      {
        where: { owner: provider.owner },
        transaction: t
      }
    );

    for (const node of data.cluster.inventory.cluster.nodes) {
      const providerSnapshotNode = await ProviderSnapshotNode.create(
        {
          snapshotId: createdSnapshot.id,
          name: node.name,
          cpuAllocatable: parseDecimalKubernetesString(node.resources.cpu.quantity.allocatable.string) * 1000,
          cpuAllocated: parseDecimalKubernetesString(node.resources.cpu.quantity.allocated.string) * 1000,
          memoryAllocatable: parseInt(node.resources.memory.quantity.allocatable.string),
          memoryAllocated: parseSizeStr(node.resources.memory.quantity.allocated.string),
          ephemeralStorageAllocatable: parseInt(node.resources.ephemeralStorage.allocatable.string),
          ephemeralStorageAllocated: parseSizeStr(node.resources.ephemeralStorage.allocated.string),
          capabilitiesStorageHDD: node.capabilities.storageClasses.includes("beta1"),
          capabilitiesStorageSSD: node.capabilities.storageClasses.includes("beta2"),
          capabilitiesStorageNVME: node.capabilities.storageClasses.includes("beta3"),
          gpuAllocatable: parseDecimalKubernetesString(node.resources.gpu.quantity.allocatable.string),
          gpuAllocated: parseDecimalKubernetesString(node.resources.gpu.quantity.allocated.string)
        },
        { transaction: t }
      );

      for (const cpuInfo of node.resources.cpu.info) {
        await ProviderSnapshotNodeCPU.create(
          {
            snapshotNodeId: providerSnapshotNode.id,
            vendor: cpuInfo.vendor,
            model: cpuInfo.model,
            vcores: cpuInfo.vcores // TODO: Change type to integer?
          },
          { transaction: t }
        );
      }

      for (const gpuInfo of node.resources.gpu.info) {
        await ProviderSnapshotNodeGPU.create(
          {
            snapshotNodeId: providerSnapshotNode.id,
            vendor: gpuInfo.vendor,
            name: gpuInfo.name,
            modelId: gpuInfo.modelid,
            interface: gpuInfo.interface,
            memorySize: gpuInfo.memorySize // TODO: Change type to bytes?
          },
          { transaction: t }
        );
      }
    }
  });
  console.timeEnd("updateData");
}

function sumResources(resources) {
  const resourcesArr = resources?.nodes || resources || [];

  return resourcesArr
    .map((x) => ({
      cpu: parseDecimalKubernetesString(x.cpu) * 1000,
      gpu: x.gpu ? parseDecimalKubernetesString(x.gpu) : 0,
      memory: parseSizeStr(x.memory),
      storage: parseSizeStr(x.ephemeralStorage)
    }))
    .reduce(
      (prev, next) => ({
        cpu: prev.cpu + next.cpu,
        gpu: prev.gpu + next.gpu,
        memory: prev.memory + next.memory,
        storage: prev.storage + next.storage
      }),
      {
        cpu: 0,
        gpu: 0,
        memory: 0,
        storage: 0
      }
    );
}

type NewStatusResponseType = {
  cluster: {
    leases: { active?: number };
    inventory: {
      cluster: {
        nodes: {
          name: string;
          resources: {
            cpu: {
              quantity: {
                allocatable: {
                  string: string;
                };
                allocated: {
                  string: string;
                };
              };
              info: {
                id: string;
                vendor: string;
                model: string;
                vcores: number;
              }[];
            };
            memory: {
              quantity: {
                allocatable: {
                  string: string;
                };
                allocated: {
                  string: string;
                };
              };
            };
            gpu: {
              quantity: {
                allocatable: {
                  string: string;
                };
                allocated: {
                  string: string;
                };
              };
              info: {
                vendor: string;
                name: string;
                modelid: string;
                interface: string;
                memorySize: string;
              }[];
            };
            ephemeralStorage: {
              allocatable: {
                string: string;
              };
              allocated: {
                string: string;
              };
            };
            volumesAttached: {
              allocatable: {
                string: string;
              };
              allocated: {
                string: string;
              };
            };
            volumesMounted: {
              allocatable: {
                string: string;
              };
              allocated: {
                string: string;
              };
            };
          };
          capabilities: {
            storageClasses: ("beta1" | "beta2" | "beta3")[];
          };
        }[];
      };
      reservations: {
        pending: {
          resources: {
            cpu: {
              string: string;
            };
            memory: {
              string: string;
            };
            gpu: {
              string: string;
            };
            ephemeralStorage: {
              string: string;
            };
          };
        };
        active: {
          resources: {
            cpu: {
              string: string;
            };
            memory: {
              string: string;
            };
            gpu: {
              string: string;
            };
            ephemeralStorage: {
              string: string;
            };
          };
        };
      };
    };
  };
  bidEngine: {};
  manifest: {
    deployments: number;
  };
  publicHostnames: string[];
  timestamp: string;
};
