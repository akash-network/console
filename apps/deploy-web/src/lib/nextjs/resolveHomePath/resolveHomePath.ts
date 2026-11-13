import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";
import { isAuthenticated, isFeatureEnabled } from "../pageGuards/pageGuards";

export async function resolveHomePath(context: AppTypedContext): Promise<string> {
  const { urlService } = context.services;
  const isProjectsHome = (await isAuthenticated(context)) && (await isFeatureEnabled("onboarding_intent_first", context));

  return isProjectsHome ? urlService.projects() : urlService.deploymentList();
}
