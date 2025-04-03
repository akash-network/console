import type { components } from "@octokit/openapi-types";
export type GithubRepository = components["schemas"]["full-repository"];
export type IGithubDirectoryItem = Omit<components["schemas"]["content-directory"][0], "type"> & {
  type: "file" | "dir" | "commit_directory" | "tree";
};
export type Owner = components["schemas"]["full-repository"]["owner"];

export interface RollBackType {
  name: string;
  value: string;
  date: Date;
}

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface CustomRepo {
  name: string;
  id?: string;
  default_branch: string;
  html_url: string;
  userName?: string;
  private: boolean;
  owner?: Owner;
}

export interface GitProviderTokens {
  accessToken: string;
  refreshToken: string;
}
