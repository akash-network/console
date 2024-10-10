import { activeChain } from "@akashnetwork/database/chainDefinitions";
import path from "path";

import { env } from "./utils/env";

export const averageBlockTime = 6.174;
export const averageDaysInMonth = 30.437;
export const averageHoursInAMonth = averageDaysInMonth * 24;
export const averageBlockCountInAMonth = (averageDaysInMonth * 24 * 60 * 60) / averageBlockTime;
export const isProd = env.NODE_ENV === "production";

export enum ExecutionMode {
  DoNotSync,
  SyncOnly,
  RebuildStats,
  RebuildAll
}

export const executionMode: ExecutionMode = ExecutionMode.SyncOnly;
export const lastBlockToSync = Number.POSITIVE_INFINITY;

export const dataFolderPath = path.join(env.DATA_FOLDER, activeChain.code);
export const concurrentNodeQuery = 5;
