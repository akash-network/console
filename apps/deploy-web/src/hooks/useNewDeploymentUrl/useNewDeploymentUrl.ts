import { useFlag } from "@src/hooks/useFlag";
import type { NewDeploymentParams } from "@src/utils/urlUtils";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useFlag, UrlService };

/**
 * Resolves the "open the deployment editor" destination. With `onboarding_redesign_v1` on, a concrete build
 * intent — a chosen template or the `edit-deployment` step — opens the new `/new-deployment/configure` screen.
 * A bare "new deployment" keeps the classic `/new-deployment` deployment-type/template picker so it stays the
 * reachable entry point (its own template picks then route on to configure); git, redeploy, and VM
 * (`deploy-linux`) intents are not representable on configure and always keep the classic URL.
 */
export function useNewDeploymentUrl(dependencies = DEPENDENCIES) {
  const d = dependencies;
  const isRedesignEnabled = d.useFlag("onboarding_redesign_v1");

  return function newDeploymentUrl(params: NewDeploymentParams = {}) {
    const isClassicOnly = !!params.redeploy || !!params.gitProvider || !!params.repoUrl || params.page === "deploy-linux";
    const opensBuilder = params.step === "edit-deployment" || !!params.templateId;
    if (isRedesignEnabled && !isClassicOnly && opensBuilder) {
      return d.UrlService.configureDeployment({ templateId: params.templateId });
    }
    return d.UrlService.newDeployment(params);
  };
}
