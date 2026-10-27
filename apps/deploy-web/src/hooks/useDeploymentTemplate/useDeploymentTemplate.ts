import type { TemplateOutput } from "@akashnetwork/http-sdk";

import { useServices } from "@src/context/ServicesProvider";
import { catchDeploymentReadError } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { usePublicTemplate } from "@src/queries/useTemplateQuery";
import { SKIP_REPORTING_BELOW_SERVER_ERROR } from "@src/services/query-error-policy/query-error-policy";

export const DEPENDENCIES = { useServices, usePublicTemplate };

export interface DeploymentTemplate {
  templateId: string | undefined;
  /** Absent until it loads, and for good once the gallery no longer has the template. */
  template: TemplateOutput | undefined;
}

/** The gallery template the console recorded a deployment as created from. */
export function useDeploymentTemplate(dseq: string, dependencies = DEPENDENCIES): DeploymentTemplate {
  const { api } = dependencies.useServices();
  const { data: templateId } = api.v1.getDeployment.useQuery(
    { dseq },
    {
      enabled: !!dseq,
      catchError: catchDeploymentReadError,
      select: response => response?.data?.consoleSettings?.templateId ?? undefined
    }
  );
  const { data: template } = dependencies.usePublicTemplate(templateId, { meta: SKIP_REPORTING_BELOW_SERVER_ERROR });

  return { templateId, template };
}
