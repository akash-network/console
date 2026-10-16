import type { operationDefs } from "@akashnetwork/console-api-types";

export type DeploymentSpendReport = operationDefs["listDeploymentSpend"]["responses"][200]["content"]["application/json"]["data"];

export type DeploymentSpend = DeploymentSpendReport["deployments"][number];

export type DailyProjectSpend = DeploymentSpendReport["days"][number];
