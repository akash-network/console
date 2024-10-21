import { nanoid } from "nanoid";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";

export class EnvVarUpdater {
  private services: ServiceType[];

  constructor(services: ServiceType[]) {
    this.services = services;
  }

  public addOrUpdateEnvironmentVariable(key: string, value: string, isSecret: boolean): SdlBuilderFormValuesType["services"][0]["env"] {
    const environmentVariables = this.services[0]?.env || [];
    const existingVariable = environmentVariables.find(envVar => envVar.key === key);

    if (existingVariable) {
      return environmentVariables.map(envVar => {
        if (envVar.key === key) {
          return { ...envVar, value, isSecret };
        }
        return envVar;
      });
    } else {
      return [...environmentVariables, { id: nanoid(), key, value, isSecret }];
    }
  }

  public deleteEnvironmentVariable(key: string): SdlBuilderFormValuesType["services"][0]["env"] {
    const environmentVariables = this.services[0]?.env || [];
    return environmentVariables.filter(envVar => envVar.key !== key);
  }
}

export function formatUrlWithoutInitialPath(url?: string): string | undefined {
  return url?.split("/").slice(-2).join("/");
}

export function isImageInYaml(yml: string, cicdYml?: string): boolean | undefined {
  return cicdYml?.includes(yml?.split("service-1:")?.[1]?.split("expose:")?.[0]?.split("image: ")?.[1]);
}

export function extractRepositoryUrl(yml?: string | null): string | null {
  if (!yml) return null;

  const lines = yml.split("\n");
  const envStartIndex = lines.findIndex(line => line.includes("env:"));
  const profileStartIndex = lines.findIndex(line => line.includes("profiles:"));
  const envVariables = lines.slice(envStartIndex + 1, profileStartIndex);
  const repoUrlLine = envVariables.find(line => line.includes("REPO_URL"));

  return repoUrlLine ? repoUrlLine.split("=")[1] : null;
}
