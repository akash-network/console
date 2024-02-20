import { Provider, ProviderSnapshot, ProviderSnapshotNode, ProviderSnapshotNodeCPU, ProviderSnapshotNodeGPU } from "@shared/dbSchemas/akash";
import { sequelize } from "@src/db/dbConnection";
import { toUTC } from "@src/shared/utils/date";
import { parseDecimalKubernetesString, parseSizeStr } from "@src/shared/utils/files";
import { isSameDay } from "date-fns";
import { createPromiseClient } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { ProviderRPC } from "@src/proto/gen/akash/provider/v1/service_connect";
import { ReservationsMetric, Status } from "@src/proto/gen/akash/provider/v1/status_pb";

export async function fetchAndSaveProviderStats(provider: Provider, cosmosSdkVersion: string, version: string, timeout: number) {
  const data = await queryStatus(provider.hostUri, timeout);

  const activeResources = data.cluster.inventory.reservations.active.resources;
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

  console.log(activeResources, pendingResources, availableResources);
  throw "STOP";

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
            vcores: cpuInfo.vcores
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
}

async function queryStatus(hostUri: string, timeout: number): Promise<Status> {
  // return new Promise((resolve, reject) => {
  //   try {
  // const protosetBuffer = fs.readFileSync("./src/proto/akash/providerServiceDescriptor.bin");
  // const descriptorSet = loadFileDescriptorSetFromBuffer(protosetBuffer);
  // const packageDef = grpc.loadPackageDefinition(descriptorSet);
  // const clientInsecureCreds = grpc.credentials.createInsecure();
  // grpc.setLogger(console);
  // grpc.setLogVerbosity(grpc.logVerbosity.DEBUG);
  // const sslCreds = grpc.credentials.createSsl(undefined, undefined, undefined, {
  //   checkServerIdentity: (hostname: string, cert: PeerCertificate) => undefined
  // });

  const url = hostUri.replace(":8443", ":8444"); // Use 8444 as default GRPC port for now, enventually get from on-chain data
  console.log(url);
  //const grpcClient = new (packageDef as any).akash.provider.v1.ProviderRPC("104.154.172.246:8444", clientInsecureCreds); // TODO: Add deadline { deadline: Date.now() + timeout },

  // console.log(grpcClient.getStatus.toString);
  // const call = grpcClient.getStatus({deadline: Number.POSITIVE_INFINITY}, (err, response) => {
  //   console.log("err", err, "response", response);
  //   if (err) {
  //     reject(err);
  //   } else {
  //     resolve(response);
  //   }
  // });
  // call.on("data", function (data) {
  //   console.log("data", data);
  // });
  // call.on("end", function () {
  //   console.log("On End -----");
  // });
  // call.on("error", function (e) {
  //   console.log("On Error", e);
  // });
  // call.on("status", function (status) {
  //   console.log("On Status ------", status);
  // });
  //console.log("Call", call);

  // const transport = createConnectTransport({
  //   httpVersion: "1.1",
  //   baseUrl: "104.154.172.246:8444"
  // });
  console.time("grpc");
  const transport = createGrpcTransport({
    // Requests will be made to <baseUrl>/<package>.<service>/method
    baseUrl: url,

    // You have to tell the Node.js http API which HTTP version to use.
    httpVersion: "2",
    nodeOptions: { rejectUnauthorized: false },

    // Interceptors apply to all calls running through this transport.
    interceptors: []
  });
  const client = createPromiseClient(ProviderRPC, transport);
  const res = await client.getStatus({});

  console.log(res);
  console.timeEnd("grpc");
  return res;
  //   } catch (err) {
  //     reject(err);
  //   }
  // });
}

function sumResources(resources: any) {
  console.log(resources);
  const resourcesArr = resources?.nodes || resources || [];
  resources.resources;
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
