import type { operationDefs } from "@akashnetwork/console-api-types";

type ServedDeploymentSpendReport = operationDefs["listDeploymentSpend"]["responses"][200]["content"]["application/json"]["data"];

type ServedDeploymentSpend = ServedDeploymentSpendReport["deployments"][number];

type GpuUsageFields = "gpuHours" | "gpuModels";

/** An api older than the gpu hours report leaves its fields out, which must not read as a deployment that used no gpu. */
export type DeploymentSpend = Omit<ServedDeploymentSpend, GpuUsageFields> & Partial<Pick<ServedDeploymentSpend, GpuUsageFields>>;

export type DeploymentSpendReport = Omit<ServedDeploymentSpendReport, "deployments"> & { deployments: DeploymentSpend[] };

export type DailyProjectSpend = DeploymentSpendReport["days"][number];
