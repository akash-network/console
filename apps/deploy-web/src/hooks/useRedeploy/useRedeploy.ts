import { useRouter } from "next/navigation";

import { createConfigureDraft } from "@src/components/deployments/ConfigureDeployment/useConfigureDraft/useConfigureDraft";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useRouter, UrlService, createConfigureDraft };

export interface RedeployInput {
  /** The previous deployment's SDL, recovered from local storage. Seeds the editor when present. */
  sdl?: string;
  /** The previous deployment's name, carried through so it prefills on the new flow. */
  name?: string;
}

/**
 * Navigates to the configure flow to redeploy a deployment. A recovered SDL is minted into a draft and opened at
 * `configure?draftId=<id>` (name carried through) so the previous spec prefills; with no SDL it opens a blank
 * configure screen. Redeploy always starts a fresh deployment, so the original dseq is not part of the destination.
 */
export function useRedeploy(dependencies = DEPENDENCIES) {
  const d = dependencies;
  const router = d.useRouter();

  return function redeploy({ sdl, name }: RedeployInput) {
    if (sdl) {
      const draftId = d.createConfigureDraft(sdl, name);
      router.push(d.UrlService.configureDeployment({ draftId }));
      return;
    }
    router.push(d.UrlService.configureDeployment({}));
  };
}
