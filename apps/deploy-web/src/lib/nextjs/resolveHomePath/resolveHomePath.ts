import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "../pageGuards/pageGuards";

/** Projects needs the organizations flag too, since the page is not found without it. */
export async function resolveHomePath(context: AppTypedContext): Promise<string> {
  const { urlService } = context.services;
  const isProjectsHome =
    (await isAuthenticated(context)) && (await isFeatureEnabled("onboarding_intent_first", context)) && (await isFeatureEnabled("organizations", context));

  return isProjectsHome ? urlService.projects() : urlService.deploymentList();
}
