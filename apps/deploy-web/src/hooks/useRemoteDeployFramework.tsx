import { useState } from "react";

import { usePackageJson } from "@src/components/remote-deploy/api/api";
import { useBitPackageJson } from "@src/components/remote-deploy/api/bitbucket-api";
import { useGitlabPackageJson } from "@src/components/remote-deploy/api/gitlab-api";
import { removeInitialUrl } from "@src/components/remote-deploy/utils";
import { ServiceType } from "@src/types";

const frameworks = [
  {
    title: "React",
    value: "react",
    image: "https://static-00.iconduck.com/assets.00/react-icon-512x456-2ynx529a.png"
  },
  {
    title: "Vue",
    value: "vue",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Vue.js_Logo.svg/1200px-Vue.js_Logo.svg.png"
  },
  {
    title: "Angular",
    value: "angular",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Angular_full_color_logo.svg/1200px-Angular_full_color_logo.svg.png"
  },
  {
    title: "Svelte",
    value: "svelte",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Svelte_Logo.svg/1200px-Svelte_Logo.svg.png"
  },
  {
    title: "Next.js",
    value: "next",
    image: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/nextjs-icon.png"
  },

  {
    title: "Astro",
    value: "astro",
    image: "https://icon.icepanel.io/Technology/png-shadow-512/Astro.png"
  },
  {
    title: "Nuxt.js",
    value: "nuxt",
    image: "https://v2.nuxt.com/_nuxt/icons/icon_64x64.6dcbd4.png"
  },

  {
    title: "Gridsome ",
    value: "gridsome",
    image: "https://gridsome.org/assets/static/favicon.b9532cc.c6d52b979318cc0b0524324281174df2.png"
  },
  {
    title: "Vite",
    value: "vite",
    image: "https://vitejs.dev/logo.svg"
  },
  {
    title: "Other",
    value: "other"
  }
];
const useRemoteDeployFramework = ({ services, setValue, subFolder }: { services: ServiceType[]; setValue: any; repos?: any; subFolder?: string }) => {
  const [data, setData] = useState<any>(null);
  const selected = services?.[0]?.env?.find(e => e.key === "REPO_URL")?.value;

  const setValueHandler = (data: any) => {
    if (data?.dependencies) {
      setData(data);
      const cpus = (Object.keys(data?.dependencies ?? {})?.length / 10 / 2)?.toFixed(1);

      setValue("services.0.profile.cpu", +cpus > 2 ? +cpus : 2);
    } else {
      setData(null);
    }
  };

  const { isLoading } = usePackageJson(setValueHandler, removeInitialUrl(selected), subFolder);
  const { isLoading: gitlabLoading, isFetching } = useGitlabPackageJson(
    setValueHandler,
    services?.[0]?.env?.find(e => e.key === "GITLAB_PROJECT_ID")?.value,
    subFolder
  );

  const { isLoading: bitbucketLoading } = useBitPackageJson(
    setValueHandler,
    removeInitialUrl(selected),
    services?.[0]?.env?.find(e => e.key === "BRANCH_NAME")?.value,
    subFolder
  );

  return {
    currentFramework: frameworks.find(f => data?.scripts?.dev?.includes(f.value)) ?? {
      title: "Other",
      value: "other"
    },
    isLoading: isLoading || gitlabLoading || bitbucketLoading || isFetching
  };
};

export default useRemoteDeployFramework;
