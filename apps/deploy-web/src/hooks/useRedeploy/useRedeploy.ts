import { useRouter } from "next/navigation";

import { createConfigureDraft } from "@src/components/deployments/ConfigureDeployment/useConfigureDraft/useConfigureDraft";
import { secretReferenceNamesIn } from "@src/utils/sdl/sdlSecrets";
import { UrlService } from "@src/utils/urlUtils";

// eslint-disable-next-line akash/dependencies-component-or-hook
export const DEPENDENCIES = { useRouter, UrlService, createConfigureDraft };

export interface RedeployInput {
  /** The previous deployment's resolved SDL, which seeds the editor when present. */
  sdl?: string;
  /** The previous deployment's name, carried through so it prefills on the new flow. */
  name?: string;
  /** The deployment being redeployed; named on the draft when its SDL references secrets, so the new deployment can inherit their stored values. */
  sourceDseq?: string;
}

/** Opens the configure flow on a draft minted from the previous SDL, or blank without one; redeploy always starts a fresh deployment, so the original dseq is dropped. */
export function useRedeploy(dependencies = DEPENDENCIES) {
  const d = dependencies;
  const router = d.useRouter();

  return function redeploy({ sdl, name, sourceDseq }: RedeployInput) {
    if (sdl) {
      const inheritsSecrets = !!sourceDseq && secretReferenceNamesIn(sdl).size > 0;
      const draftId = d.createConfigureDraft(sdl, { name, ...(inheritsSecrets ? { inheritSecretsFrom: sourceDseq } : {}) });
      router.push(d.UrlService.configureDeployment({ draftId }));
      return;
    }
    router.push(d.UrlService.configureDeployment({}));
  };
}
