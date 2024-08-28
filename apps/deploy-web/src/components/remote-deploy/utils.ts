import { Control } from "react-hook-form";
import { nanoid } from "nanoid";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { github } from "@src/utils/templates";
import { Owner } from "./remoteTypes";

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
export const REDIRECT_URL = "https://akashconsole.vercel.app/new-deployment?step=edit-deployment&type=github";
export type ServiceControl = Control<SdlBuilderFormValuesType>;
export function appendEnv(key: string, value: string, isSecret: boolean, setValue: any, services: ServiceType[]) {
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

export function removeEnv(key: string, setValue: any, services: ServiceType[]) {
  const previousEnv = services[0]?.env || [];
  const newEnv = previousEnv.filter(e => e.key !== key);
  setValue("services.0.env", newEnv);
}

export const removeInitialUrl = (url?: string) => {
  return url?.split("/").slice(-2).join("/");
};

export interface RepoType {
  name: string;
  id: string;
  default_branch: string;
  html_url: string;
  userName: string;
  private: boolean;
  owner?: Owner;
}

export const isRedeployImage = (yml: string) => {
  return github.content.includes(yml?.split("service-1:")?.[1]?.split("expose:")?.[0]?.split("image: ")?.[1]);
};
