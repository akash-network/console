import { netConfig, type SupportedChainNetworks } from "@akashnetwork/net";

import { env } from "./env";

export const averageBlockTime = 6;
export const averageDaysInMonth = 30.437;
export const averageHoursInAMonth = averageDaysInMonth * 24;
export const averageBlockCountInAMonth = (averageDaysInMonth * 24 * 60 * 60) / averageBlockTime;
export const averageBlockCountInAnHour = (60 * 60) / averageBlockTime;

export const dataFolderPath = "./dist/.data";

// Open API examples
export const openApiExampleAddress = "akash13265twfqejnma6cc93rw5dxk4cldyz2zyy8cdm";
export const openApiExampleProviderAddress = "akash18ga02jzaq8cw52anyhzkwta5wygufgu6zsz6xc";
export const openApiExampleTransactionHash = "A19F1950D97E576F0D7B591D71A8D0366AA8BA0A7F3DA76F44769188644BE9EB";
export const openApiExampleValidatorAddress = "akashvaloper14mt78hz73d9tdwpdvkd59ne9509kxw8yj7qy8f";

export const apiNodeUrl = env.REST_API_NODE_URL ?? netConfig.getBaseAPIUrl(env.NETWORK as SupportedChainNetworks) ?? netConfig.getBaseAPIUrl("mainnet");
export const betaTypeVersion = "v1beta3";
export const betaTypeVersionMarket = "v1beta4";
export const nodeApiBasePath = env.NODE_API_BASE_PATH;
