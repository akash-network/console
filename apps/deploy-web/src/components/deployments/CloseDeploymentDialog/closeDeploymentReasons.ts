import type { operationDefs } from "@akashnetwork/console-api-types";

type UpdateDeploymentSettingData = NonNullable<operationDefs["updateDeploymentSetting"]["requestBody"]>["content"]["application/json"]["data"];

export type DeploymentCloseReasonInput = Required<Pick<UpdateDeploymentSettingData, "closeReason">> & Pick<UpdateDeploymentSettingData, "closeReasonDetails">;
export type DeploymentCloseReason = DeploymentCloseReasonInput["closeReason"];

export const DEPLOYMENT_CLOSE_REASONS: { value: DeploymentCloseReason; label: string }[] = [
  { value: "no_longer_needed", label: "No longer needed" },
  { value: "cost_or_budget", label: "Cost or budget" },
  { value: "migrating_elsewhere", label: "Migrating elsewhere" },
  { value: "performance_or_reliability", label: "Performance or reliability" },
  { value: "testing_or_project_complete", label: "Testing or project complete" },
  { value: "other", label: "Other" }
];

export const MAX_CLOSE_REASON_DETAILS_LENGTH = 1000;

/** The details box only shows for the other reason, so text typed there before switching to a listed reason is not sent. */
export function toCloseReasonInput(closeReason: DeploymentCloseReason, details: string): DeploymentCloseReasonInput {
  return { closeReason, closeReasonDetails: closeReason === "other" ? details.trim() || undefined : undefined };
}
