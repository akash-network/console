import { useSetAtom } from "jotai";
import { useRouter } from "next/navigation";

import { createConfigureDraft } from "@src/components/deployments/ConfigureDeployment/useConfigureDraft/useConfigureDraft";
import { deployTargetProjectIdAtom } from "@src/store/deployTargetStore";
import { UrlService } from "@src/utils/urlUtils";

// eslint-disable-next-line akash/dependencies-component-or-hook
export const DEPENDENCIES = { useRouter, UrlService, createConfigureDraft };

export interface SaveAsTemplateInput {
  sdl: string;
  /** The name the template starts from, prefilled in the save dialog. */
  name?: string;
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

  return function saveAsTemplate({ sdl, name, projectId, dseq }: SaveAsTemplateInput) {
    handOverProject(projectId ?? null);
    const draftId = d.createConfigureDraft(sdl, { name });
    router.push(d.UrlService.configureTemplate({ mode: "new", draftId, sourceDseq: dseq }));
  };
}
