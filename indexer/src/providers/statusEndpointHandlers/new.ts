import { Provider, ProviderSnapshot, ProviderSnapshotNode, ProviderSnapshotNodeCPU, ProviderSnapshotNodeGPU } from "@shared/dbSchemas/akash";
import { sequelize } from "@src/db/dbConnection";
import { toUTC } from "@src/shared/utils/date";
import { parseDecimalKubernetesString, parseSizeStr } from "@src/shared/utils/files";
import { isSameDay } from "date-fns";
import { exec } from "child_process";

async function execAsync(command: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      }
      resolve(stdout.toString());
    });
  });
}

export async function fetchAndSaveProviderStats(provider: Provider, cosmosSdkVersion: string, version: string, timeout: number) {
  const url = provider.hostUri.replace("8443", "8444"); // Use 8444 as default GRPC port for now, enventually get from on-chain data
  const response = await execAsync(`grpcurl -insecure ${url} akash.provider.v1.ProviderRPC.GetStatus`);

  const data = JSON.parse(response) as NewStatusResponseType;

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
        nodes: [
          {
            name: "node1";
            resources: {
              cpu: {
                quantity: {
                  allocatable: {
                    string: "16";
                  };
                  allocated: {
                    string: "6870m";
                  };
                };
                info: [
                  {
                    id: "0";
                    vendor: "GenuineIntel";
                    model: "Intel(R) Xeon(R) CPU @ 2.20GHz";
                    vcores: 16;
                  }
                ];
              };
              memory: {
                quantity: {
                  allocatable: {
                    string: "67309027328";
                  };
                  allocated: {
                    string: "10834980Ki";
                  };
                };
              };
              gpu: {
                quantity: {
                  allocatable: {
                    string: "1";
                  };
                  allocated: {
                    string: "0";
                  };
                };
                info: [
                  {
                    vendor: "nvidia";
                    name: "a100";
                    modelid: "20b0";
                    interface: "SXM4";
                    memorySize: "40Gi";
                  }
                ];
              };
              ephemeralStorage: {
                allocatable: {
                  string: "233966001789";
                };
                allocated: {
                  string: "0";
                };
              };
              volumesAttached: {
                allocatable: {
                  string: "0";
                };
                allocated: {
                  string: "0";
                };
              };
              volumesMounted: {
                allocatable: {
                  string: "0";
                };
                allocated: {
                  string: "0";
                };
              };
            };
            capabilities: {
              storageClasses: ("beta1" | "beta2" | "beta3")[];
            };
          }
        ];
      };
      reservations: {
        pending: {
          resources: {
            cpu: {
              string: "0";
            };
            memory: {
              string: "0";
            };
            gpu: {
              string: "0";
            };
            ephemeralStorage: {
              string: "0";
            };
          };
        };
        active: {
          resources: {
            cpu: {
              string: "0";
            };
            memory: {
              string: "0";
            };
            gpu: {
              string: "0";
            };
            ephemeralStorage: {
              string: "0";
            };
          };
        };
      };
    };
  };
  bidEngine: {};
  manifest: {
    deployments: 1;
  };
  publicHostnames: ["provider.akashtesting.xyz"];
  timestamp: "2024-01-31T16:53:28.982937903Z";
};
