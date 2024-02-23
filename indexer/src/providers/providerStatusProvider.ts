import https from "https";
import axios from "axios";
import semver from "semver";
import { Provider } from "@shared/dbSchemas/akash";
import { asyncify, eachLimit } from "async";
import { ProviderSnapshot } from "@src/../../shared/dbSchemas/akash/providerSnapshot";
import { fetchAndSaveProviderStats as grpcFetchAndSaveProviderStats } from "./statusEndpointHandlers/grpc";
import { fetchAndSaveProviderStats as restFetchAndSaveProviderStats } from "./statusEndpointHandlers/rest";

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

        const akashVersion = semver.valid(versionResponse.data.akash.version);
        const cosmosVersion = semver.valid(
          "cosmosSdkVersion" in versionResponse.data.akash ? versionResponse.data.akash.cosmosSdkVersion : versionResponse.data.akash.cosmos_sdk_version
        );

        if (akashVersion && semver.gte(akashVersion, "0.5.0-0")) {
          await grpcFetchAndSaveProviderStats(provider, cosmosVersion, akashVersion, StatusCallTimeout);
        } else {
          await restFetchAndSaveProviderStats(provider, cosmosVersion, akashVersion, StatusCallTimeout);
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

type ProviderVersionEndpointResponseType =
  | {
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
    }
  | {
      akash: {
        name: string;
        server_name: string;
        version: string;
        commit: string;
        build_tags: string;
        go: string;
        cosmos_sdk_version: string;
      };
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
