import { useTemplates } from "@src/context/TemplatesProvider";

const yaml = require("js-yaml");

export const useGpuTemplates = () => {
  const { isLoading: isLoadingTemplates, categories } = useTemplates();
  let gpuTemplates = categories?.find(x => x.title === "AI - GPU")?.templates || [];

  gpuTemplates = gpuTemplates.map(x => {
    const templateSdl = yaml.load(x.deploy);

    return {
      ...x,
      image: templateSdl.services[Object.keys(templateSdl.services)[0]].image
    };
  });

  return { isLoadingTemplates, gpuTemplates };
};
