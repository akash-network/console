import type { operationDefs } from "@akashnetwork/console-api-types";

export const PROJECT_DEPLOYMENT_STATUSES = ["running", "spinning", "degraded", "reclaiming", "closed"] as const;

export type ProjectDeploymentStatus = (typeof PROJECT_DEPLOYMENT_STATUSES)[number];

export interface ProjectDeploymentPreview {
  dseq: string;
  name: string;
  status: ProjectDeploymentStatus;
}

/** What a project folder shows of its open deployments: how many there are and the newest few. */
export interface ProjectDeploymentSummary {
  /** Undefined when the api could not count them and more remain than were read. */
  activeCount: number | undefined;
  preview: ProjectDeploymentPreview[];
}

export type ProjectOutput = operationDefs["listProjects"]["responses"][200]["content"]["application/json"]["data"][number];

/** A project of the active organization, with the summary of its open deployments once it has been read. */
export type Project = ProjectOutput & { deploymentSummary?: ProjectDeploymentSummary };

export type CreateProjectInput = operationDefs["createProject"]["requestBody"]["content"]["application/json"];

/** The `code` of the 409 `createProject` returns when the active organization already has a project by that name. */
export const PROJECT_NAME_TAKEN_ERROR_CODE = "project_name_taken";

/** The `code` of the 409 `deleteProject` answers for the organization's default project. */
export const PROJECT_IS_DEFAULT_ERROR_CODE = "project_is_default";

/** The `code` of the 409 `deleteProject` answers while the project still holds an open deployment. */
export const PROJECT_NOT_EMPTY_ERROR_CODE = "project_not_empty";

export const MAX_PROJECT_SLUG_LENGTH = 40;

export const MAX_PROJECT_DESCRIPTION_LENGTH = 140;

export type ProjectMember = operationDefs["listProjectMembers"]["responses"][200]["content"]["application/json"]["data"][number];

export type ProjectRole = ProjectMember["role"];

/** Where a deployment is filed; `projectId` is null for one the console has not filed into a project yet. */
export type DeploymentLocation = operationDefs["getDeploymentLocation"]["responses"][200]["content"]["application/json"]["data"];

/** The `code` of the 400 `createDeployment` answers when the caller may write to no default project and named none. */
export const PROJECT_REQUIRED_ERROR_CODE = "project_required";

/** The message of the 404 the api answers for a project that was deleted or that the caller can no longer reach. */
export const PROJECT_NOT_FOUND_MESSAGE = "Project not found";
