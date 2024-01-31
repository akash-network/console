import https from "https";
import axios from "axios";
import { Provider, ProviderSnapshotNode } from "@shared/dbSchemas/akash";
import { asyncify, eachLimit } from "async";
import { ProviderSnapshot } from "@src/../../shared/dbSchemas/akash/providerSnapshot";
import { getTodayUTC, toUTC } from "@src/shared/utils/date";
import { sequelize } from "@src/db/dbConnection";
import { QueryTypes } from "sequelize";
import { addDays } from "date-fns";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { parseSizeStr } from "@src/shared/utils/files";
const { exec } = require("child_process");

const ConcurrentStatusCall = 10;
const StatusCallTimeout = 10_000; // 10 seconds
type NewStatusResponseType = {
  cluster: {
    leases: {};
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
export async function syncProvidersInfo() {
  let providers = await Provider.findAll({
    where: {
      deletedHeight: null
    },
    order: [["isOnline", "DESC"]]
  });

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });

  const packageDefinition = protoLoader.loadSync("./src/proto/custom.proto", {});
  const ProviderRPC = grpc.loadPackageDefinition(packageDefinition).ProviderRPC;

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

  let doneCount = 0;
  await eachLimit(
    providers.slice(0, 1),
    ConcurrentStatusCall,
    asyncify(async (provider: Provider) => {
      try {
        console.log(ProviderRPC);
        //const client = new ProviderRPC["GetStatus"]('104.154.172.246:8444', grpc.credentials.createInsecure());
        //client.GetStatus({}, (err,res) => console.log(err,res))

        // const response = await axios.get(provider.hostUri + "/status", {
        //   httpsAgent: httpsAgent,
        //   timeout: StatusCallTimeout
        // });

        // if (response.status !== 200) throw "Invalid response status: " + response.status;

        const versionResponse = await axios.get(provider.hostUri + "/version", {
          httpsAgent: httpsAgent,
          timeout: StatusCallTimeout
        });

        const response = await execAsync(`grpcurl -insecure 104.154.172.246:8444 akash.provider.v1.ProviderRPC.GetStatus`);

        const data = JSON.parse(response) as NewStatusResponseType;

        const activeResources = { cpu: 0, gpu: 0, memory: 0, storage: 0 }; //sumResources(data.cluster.inventory.active);
        const pendingResources = { cpu: 0, gpu: 0, memory: 0, storage: 0 }; //sumResources(response.data.cluster.inventory.pending);
        const availableResources = { cpu: 0, gpu: 0, memory: 0, storage: 0 }; //sumResources(response.data.cluster.inventory.available);
        const checkDate = toUTC(new Date());

        await Provider.update(
          {
            isOnline: true,
            error: null,
            lastCheckDate: checkDate,
            cosmosSdkVersion: versionResponse.data.akash.cosmosSdkVersion,
            akashVersion: versionResponse.data.akash.version,
            deploymentCount: data.manifest.deployments,
            leaseCount: 0, //data.cluster.leases,
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
            where: { owner: provider.owner }
          }
        );

        const createdSnapshot = await ProviderSnapshot.create({
          owner: provider.owner,
          isOnline: true,
          checkDate: checkDate,
          deploymentCount: data.manifest.deployments,
          leaseCount: 0, // data.cluster.leases,
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
        });

        for (let node of data.cluster.inventory.cluster.nodes) {
          await ProviderSnapshotNode.create({
            snapshotId: createdSnapshot.id,
            name: node.name,
            cpuAllocatable: parseInt(node.resources.cpu.quantity.allocatable.string) * 1000,
            cpuAllocated: parseSizeStr(node.resources.cpu.quantity.allocated.string),
            cpuVendor: node.resources.cpu.info[0].vendor,
            cpuModel: node.resources.cpu.info[0].model,
            memoryAllocatable: parseInt(node.resources.memory.quantity.allocatable.string),
            memoryAllocated: parseSizeStr(node.resources.memory.quantity.allocated.string),
            ephemeralStorageAllocatable: parseInt(node.resources.ephemeralStorage.allocatable.string),
            ephemeralStorageAllocated: parseSizeStr(node.resources.ephemeralStorage.allocated.string),
            capabilitiesStorageHDD: node.capabilities.storageClasses.includes("beta1"),
            capabilitiesStorageSSD: node.capabilities.storageClasses.includes("beta2"),
            capabilitiesStorageNVME: node.capabilities.storageClasses.includes("beta3"),
            gpuAllocatable: parseInt(node.resources.gpu.quantity.allocatable.string),
            gpuAllocated: parseInt(node.resources.gpu.quantity.allocated.string),
            gpuVendor: node.resources.gpu.info?.[0].vendor,
            gpuName: node.resources.gpu.info?.[0].name,
            gpuModelId: node.resources.gpu.info?.[0].modelid,
            gpuInterface: node.resources.gpu.info?.[0].interface,
            gpuMemorySize: node.resources.gpu.info?.[0].memorySize
          });
        }
      } catch (err) {
        const checkDate = new Date();
        const errorMessage = err?.message?.toString() ?? err?.toString();

        await Provider.update(
          {
            isOnline: false,
            lastCheckDate: checkDate,
            error: errorMessage,
            akashVersion: null,
            cosmosSdkVersion: null,
            deploymentCount: null,
            leaseCount: null,
            activeCPU: null,
            activeGPU: null,
            activeMemory: null,
            activeStorage: null,
            pendingCPU: null,
            pendingGPU: null,
            pendingMemory: null,
            pendingStorage: null,
            availableCPU: null,
            availableGPU: null,
            availableMemory: null,
            availableStorage: null
          },
          {
            where: { owner: provider.owner }
          }
        );

        await ProviderSnapshot.create({
          owner: provider.owner,
          isOnline: false,
          error: errorMessage,
          checkDate: checkDate
        });
      } finally {
        doneCount++;
        console.log("Fetched provider info: " + doneCount + " / " + providers.length);
      }
    })
  );

  console.log("Finished refreshing provider infos");

  console.time("updateIsLastOfDay");
  const yesterdayDate = addDays(getTodayUTC(), -1);
  console.log("Updating isLastOfDay for provider snapshots", yesterdayDate);
  const result = await sequelize.query(
    `WITH last_snapshots AS (
    SELECT DISTINCT ON("hostUri",DATE("checkDate")) DATE("checkDate") AS date, ps."id" AS "psId", ps."activeCPU", ps."pendingCPU", ps."availableCPU", ps."activeGPU", ps."pendingGPU", ps."availableGPU", ps."activeMemory", ps."pendingMemory", ps."availableMemory", ps."activeStorage", ps."pendingStorage", ps."availableStorage", ps."isOnline"
                          FROM "providerSnapshot" ps
                          INNER JOIN "provider" ON "provider"."owner"=ps."owner"
              WHERE "checkDate" >= '${yesterdayDate.toISOString().slice(0, 10)}'
                          ORDER BY "hostUri",DATE("checkDate"),"checkDate" DESC
   ) 
   UPDATE "providerSnapshot" AS ps
   SET "isLastOfDay" = TRUE
   FROM last_snapshots AS ls
   WHERE ls."psId"=ps.id`,
    {
      type: QueryTypes.UPDATE
    }
  ); // TODO set isLastOfDay to false for all other snapshots
  console.timeEnd("updateIsLastOfDay");

  console.log(result[0], result[1]);
}

function getStorageFromResource(resource) {
  return Object.keys(resource).includes("storage_ephemeral") ? resource.storage_ephemeral : resource.storage;
}

function getUnitValue(resource) {
  return typeof resource === "number" ? resource : parseInt(resource.units.val);
}

function getByteValue(val) {
  return typeof val === "number" ? val : parseInt(val.size.val);
}

function sumResources(resources) {
  const resourcesArr = resources?.nodes || resources || [];

  return resourcesArr
    .map((x) => ({
      cpu: getUnitValue(x.cpu),
      gpu: x.gpu ? getUnitValue(x.gpu) : 0,
      memory: getByteValue(x.memory),
      storage: getByteValue(getStorageFromResource(x))
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
