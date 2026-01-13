import { nanoid } from "nanoid";

import { browserEnvConfig } from "@src/config/browser-env.config";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";

export class EnvVarManagerService {
  private services: ServiceType[];

  constructor(services: ServiceType[]) {
    this.services = services;
  }

  public getEnvironmentVariableValue(key: string, defaultValue?: string): string | undefined {
    return this.services[0]?.env?.find(envVar => envVar.key === key)?.value ?? defaultValue;
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

  public addOrUpdateEnvironmentVariables(vars: Array<{ key: string; value: string; isSecret: boolean }>): SdlBuilderFormValuesType["services"][0]["env"] {
    let environmentVariables = this.services[0]?.env || [];

    vars.forEach(({ key, value, isSecret }) => {
      const existingVariable = environmentVariables.find(envVar => envVar.key === key);
      if (existingVariable) {
        environmentVariables = environmentVariables.map(envVar => {
          if (envVar.key === key) {
            return { ...envVar, value, isSecret };
          }
          return envVar;
        });
      } else {
        environmentVariables = [...environmentVariables, { id: nanoid(), key, value, isSecret }];
      }
    });

    return environmentVariables;
  }
}

export function formatUrlWithoutInitialPath(url?: string): string | undefined {
  return url?.split("/").slice(-2).join("/");
}

export function isCiCdImageInYaml(yml: string): boolean | undefined {
  return yml.includes(browserEnvConfig.NEXT_PUBLIC_CI_CD_IMAGE_NAME);
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
