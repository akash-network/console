import https from "https";
import axios from "axios";
import semver from "semver";
import { Provider } from "@shared/dbSchemas/akash";
import { asyncify, eachLimit } from "async";
import { ProviderSnapshot } from "@src/../../shared/dbSchemas/akash/providerSnapshot";
import { fetchAndSaveProviderStats as grpcFetchAndSaveProviderStats } from "./statusEndpointHandlers/grpc";
import { fetchAndSaveProviderStats as restFetchAndSaveProviderStats } from "./statusEndpointHandlers/rest";

const IsGrpcEnpointEnabled = false;
const ConcurrentStatusCall = 10;
const StatusCallTimeout = 10_000; // 10 seconds

export async function syncProvidersInfo() {
  let providers = await Provider.findAll({
    where: {
      deletedHeight: null
    },
    include: [{ model: ProviderSnapshot, as: "lastSnapshot" }],
    order: [["isOnline", "DESC"]]
  });

  const httpsAgent = new https.Agent({
    rejectUnauthorized: false
  });

  let doneCount = 0;
  await eachLimit(
    providers,
    ConcurrentStatusCall,
    asyncify(async (provider: Provider) => {
      try {
        const versionResponse = await axios.get<ProviderVersionEndpointResponseType>(provider.hostUri + "/version", {
          httpsAgent: httpsAgent,
          timeout: StatusCallTimeout
        });
        

        const versionStr = versionResponse.data.akash.version;
        if (IsGrpcEnpointEnabled && versionStr && semver.gte(versionStr, "0.5.0")) {
          await grpcFetchAndSaveProviderStats(provider, versionResponse.data.akash.cosmosSdkVersion, versionResponse.data.akash.version, StatusCallTimeout);
        } else {
          await restFetchAndSaveProviderStats(provider, versionResponse.data.akash.cosmosSdkVersion, versionResponse.data.akash.version, StatusCallTimeout);
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
}

type ProviderVersionEndpointResponseType = {
  akash: { version: string; commit: string; buildTags: string; go: string; cosmosSdkVersion: string };
  kube: {
    major: string;
    minor: string;
    gitVersion: string;
    gitCommit: string;
    gitTreeState: string;
    buildDate: string;
    goVersion: string;
    compiler: string;
    platform: string;
  };
};
