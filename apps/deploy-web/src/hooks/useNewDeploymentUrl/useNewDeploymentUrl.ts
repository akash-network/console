import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { UrlService };

/** Resolves the "new deployment" destination: a chosen template opens Configure directly, a bare intent keeps the `/new-deployment` picker as the entry point. */
export function useNewDeploymentUrl(dependencies = DEPENDENCIES) {
  const d = dependencies;

  return function newDeploymentUrl(params: { templateId?: string } = {}) {
    return params.templateId ? d.UrlService.configureDeployment({ templateId: params.templateId }) : d.UrlService.newDeployment();
  };
}
