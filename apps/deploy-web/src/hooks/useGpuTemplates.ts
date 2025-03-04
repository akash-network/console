import yaml from "js-yaml";

import { useTemplates } from "@src/queries/useTemplateQuery";

export const useGpuTemplates = () => {
  const { isLoading: isLoadingTemplates, categories } = useTemplates();
  let gpuTemplates = categories?.find(x => x.title === "AI - GPU")?.templates || [];

  gpuTemplates = gpuTemplates
    .map(x => {
      const templateSdl = yaml.load(x.deploy || "") as any;

      return {
        ...x,
        image: templateSdl.services[Object.keys(templateSdl.services)[0]].image
      };
    })
    .filter(x => x.id);

  return { isLoadingTemplates, gpuTemplates };
};
