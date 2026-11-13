import { useSetAtom } from "jotai";
import { useRouter } from "next/navigation";

import { createConfigureDraft } from "@src/components/deployments/ConfigureDeployment/useConfigureDraft/useConfigureDraft";
import { deployTargetProjectIdAtom } from "@src/store/deployTargetStore";
import { UrlService } from "@src/utils/urlUtils";

// eslint-disable-next-line akash/dependencies-component-or-hook
export const DEPENDENCIES = { useRouter, UrlService, createConfigureDraft };

export interface SaveAsTemplateInput {
  sdl: string;
  /** The name of the deployment the SDL comes from, which the save dialog's title starts from unless a title is suggested. */
  name?: string;
  /** A title suggested for the template, which the save dialog starts from instead of the deployment's name. */
  suggestedTitle?: string;
  /** A summary suggested for the template, which the save dialog starts from. */
  suggestedSummary?: string;
  /** The project of the deployment the SDL comes from, which the template is filed in; without one the project picker asks. */
  projectId?: string | null;
  /** The deployment the SDL comes from, which template mode links back to; absent when the SDL has no deployment behind it. */
  dseq?: string;
}

/** Opens template mode on a draft of the SDL; secrets stay references, so no deployment is named to inherit their values from. */
export function useSaveAsTemplate(dependencies = DEPENDENCIES) {
  const d = dependencies;
  const router = d.useRouter();
  const handOverProject = useSetAtom(deployTargetProjectIdAtom);

  return function saveAsTemplate({ sdl, name, suggestedTitle, suggestedSummary, projectId, dseq }: SaveAsTemplateInput) {
    handOverProject(projectId ?? null);
    const draftId = d.createConfigureDraft(sdl, { name, templateTitle: suggestedTitle, templateSummary: suggestedSummary });
    router.push(d.UrlService.configureTemplate({ mode: "new", draftId, sourceDseq: dseq }));
  };
}
