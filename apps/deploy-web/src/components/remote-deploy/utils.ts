import { Control, UseFormSetValue } from "react-hook-form";
import { nanoid } from "nanoid";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { Owner } from "@src/types/remotedeploy";
export const ciCdTemplateId = "akash-network-awesome-akash-automatic-deployment-CICD-template";
export type ServiceControl = Control<SdlBuilderFormValuesType>;
export type ServiceSetValue = UseFormSetValue<SdlBuilderFormValuesType>;
export type OAuth = "github" | "gitlab" | "bitbucket";
export const PROXY_API_URL_AUTH = "https://proxy-console-github.vercel.app";
export const hiddenEnv = [
  "REPO_URL",
  "BRANCH_NAME",
  "ACCESS_TOKEN",
  "BUILD_DIRECTORY",
  "BUILD_COMMAND",
  "NODE_VERSION",
  "CUSTOM_SRC",
  "COMMIT_HASH",
  "GITLAB_PROJECT_ID",
  "GITLAB_ACCESS_TOKEN",
  "BITBUCKET_ACCESS_TOKEN",
  "BITBUCKET_USER",
  "DISABLE_PULL",
  "GITHUB_ACCESS_TOKEN",
  "FRONTEND_FOLDER"
];
export const REDIRECT_URL = `${process.env.NEXT_PUBLIC_REDIRECT_URI}?step=edit-deployment&type=github`;
export function appendEnv(key: string, value: string, isSecret: boolean, setValue: ServiceSetValue, services: ServiceType[]) {
  const previousEnv = services[0]?.env || [];
  if (previousEnv.find(e => e.key === key)) {
    previousEnv.map(e => {
      if (e.key === key) {
        e.value = value;
        e.isSecret = isSecret;

        return e;
      }
      return e;
    });
  } else {
    previousEnv.push({ id: nanoid(), key, value, isSecret });
  }
  setValue("services.0.env", previousEnv);
}

export function removeEnv(key: string, setValue: ServiceSetValue, services: ServiceType[]) {
  const previousEnv = services[0]?.env || [];
  const newEnv = previousEnv.filter(e => e.key !== key);
  setValue("services.0.env", newEnv);
}

export const removeInitialUrl = (url?: string) => {
  return url?.split("/").slice(-2).join("/");
};

export interface RepoType {
  name: string;
  id?: string;
  default_branch: string;
  html_url: string;
  userName?: string;
  private: boolean;
  owner?: Owner;
}

export const isRedeployImage = (yml: string, ciCdYml?: string) => {
  return ciCdYml?.includes(yml?.split("service-1:")?.[1]?.split("expose:")?.[0]?.split("image: ")?.[1]);
};

export const getRepoUrl = (yml?: string | null) => {
  if (!yml) return null;
  const list = yml?.split("\n");
  const envIndex = list?.findIndex(item => item?.includes("env:"));
  const profileIndex = list?.findIndex(item => item?.includes("profiles:"));
  const env = list?.slice(envIndex + 1, profileIndex);
  const repo = env?.find(item => item?.includes("REPO_URL"));

  return repo ? repo?.split("=")[1] : null;
};

export const supportedFrameworks = [
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
