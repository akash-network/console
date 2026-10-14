import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";
import { z } from "zod";

import { PROJECT_BUDGET_EXCEEDED_ERROR_CODE } from "@src/types/project-budget";

const refusalBodySchema = z.object({ data: z.object({ projectIds: z.array(z.string()) }) });

/** Null for any other failure; otherwise the project whose budget refused the deposit, when the api named one. */
export function readProjectBudgetRefusal(cause: unknown): { projectId?: string } | null {
  if (extractApiErrorCode(cause) !== PROJECT_BUDGET_EXCEEDED_ERROR_CODE) return null;

  const parsed = refusalBodySchema.safeParse(isApiError(cause) ? cause.body : null);
  const projectId = parsed.success ? parsed.data.data.projectIds[0] : undefined;

  return projectId ? { projectId } : {};
}
