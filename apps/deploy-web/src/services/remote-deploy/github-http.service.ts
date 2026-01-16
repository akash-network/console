import type { components } from "@octokit/openapi-types";
import type { AxiosInstance } from "axios";
import type axios from "axios";

import type { GitCommit } from "@src/types/remoteCommits";
import type { GithubRepository } from "@src/types/remotedeploy";
import type { GitHubProfile } from "@src/types/remoteProfile";

type GitHubInstallationsResponse = {
  installations: components["schemas"]["installation"][];
};
type GitHubInstallationReposResponse = {
  repositories: GithubRepository[];
  total_count: number;
};
const GITHUB_API_URL = "https://api.github.com";

type GitHubServiceOptions = {
  githubAppInstallationUrl: string;
  githubClientId?: string;
  redirectUrl: string;
};

export class GitHubService {
  readonly #githubApiService: AxiosInstance;

  readonly #internalApiService: AxiosInstance;

  readonly #options: GitHubServiceOptions;

  constructor(internalApiService: AxiosInstance, createHttpClient: typeof axios.create, options: GitHubServiceOptions) {
    this.#options = options;
    this.#internalApiService = internalApiService;
    this.#githubApiService = createHttpClient({
      baseURL: GITHUB_API_URL,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    });
  }

  loginWithGithub() {
    window.location.href = this.#options.githubAppInstallationUrl;
  }

  reLoginWithGithub() {
    if (!this.#options.githubClientId) {
      throw new Error("GitHub client ID is required to re-login with GitHub");
    }

    const redirect = new URL(this.#options.redirectUrl);
    redirect.searchParams.set("step", "edit-deployment");
    redirect.searchParams.set("type", "github");

    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", this.#options.githubClientId);
    authUrl.searchParams.set("redirect_uri", redirect.toString());

    window.location.href = authUrl.toString();
  }

  async fetchUserProfile(token?: string | null) {
    const response = await this.#githubApiService.get<GitHubProfile>("/user", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchRepos(token?: string | null) {
    const { data: installations } = await this.#githubApiService.get<GitHubInstallationsResponse>("/user/installations", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!installations.installations.length) {
      return [];
    }

    const repoResults = await Promise.allSettled(
      installations.installations.map(async installation => {
        return this.#fetchAllReposForInstallation(installation.id, token);
      })
    );

    const uniqueRepos = new Map<number, GithubRepository>();
    repoResults.forEach(result => {
      if (result.status === "fulfilled") {
        result.value.forEach(repo => {
          uniqueRepos.set(repo.id, repo);
        });
      }
    });

    return Array.from(uniqueRepos.values());
  }

  async #fetchAllReposForInstallation(installationId: number, token?: string | null) {
    const repositories: GithubRepository[] = [];
    const perPage = 100;
    let page = 1;
    let totalCount: number | null = null;

    while (totalCount === null || repositories.length < totalCount) {
      const response = await this.#githubApiService.get<GitHubInstallationReposResponse>(
        `/user/installations/${installationId}/repositories?per_page=${perPage}&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const { repositories: pageRepos, total_count } = response.data;
      repositories.push(...pageRepos);
      totalCount = total_count;
      const maxPages = totalCount > 0 ? Math.ceil(totalCount / perPage) : null;

      if (pageRepos.length === 0) {
        break;
      }
      if (maxPages !== null && page >= maxPages) {
        break;
      }
      page += 1;
    }

    return repositories;
  }

  async fetchBranches(repo?: string, token?: string | null) {
    const response = await this.#githubApiService.get(`/repos/${repo}/branches`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchCommits(repo?: string, branch?: string, token?: string | null) {
    const response = await this.#githubApiService.get<GitCommit[]>(`/repos/${repo}/commits?sha=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchPackageJson(repo?: string, subFolder?: string | undefined, token?: string | null) {
    const response = await this.#githubApiService.get(`/repos/${repo}/contents/${subFolder ? `${subFolder}/` : ""}package.json`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchSrcFolders(repo: string, token?: string | null) {
    const response = await this.#githubApiService.get(`/repos/${repo}/contents`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchAccessToken(code: string) {
    const response = await this.#internalApiService.post(`/api/github/authenticate`, { code });
    return response.data;
  }
}
