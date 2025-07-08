import { useMemo } from "react";
import yaml from "js-yaml";

import { useTemplates } from "@src/queries/useTemplateQuery";

export const useGpuTemplates = () => {
  const { isLoading: isLoadingTemplates, categories } = useTemplates();
  const gpuTemplates = useMemo(() => {
    const templates = categories?.find(x => x.title === "AI - GPU")?.templates || [];

    return templates
      .map(x => {
        const templateSdl = yaml.load(x.deploy || "") as any;

        return {
          ...x,
          image: templateSdl.services[Object.keys(templateSdl.services)[0]].image
        };
      })
      .filter(x => x.id);
  }, [categories]);

  return { isLoadingTemplates, gpuTemplates };
};
