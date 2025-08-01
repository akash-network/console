import type { AxiosInstance } from "axios";
import type axios from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { REDIRECT_URL } from "@src/config/remote-deploy.config";
import type { GitCommit } from "@src/types/remoteCommits";
import type { GithubRepository } from "@src/types/remotedeploy";
import type { GitHubProfile } from "@src/types/remoteProfile";
const GITHUB_API_URL = "https://api.github.com";

export class GitHubService {
  private readonly githubApiService: AxiosInstance;
  private readonly internalApiService: AxiosInstance;

  constructor(internalApiService: AxiosInstance, createHttpClient: typeof axios.create) {
    this.internalApiService = internalApiService;
    this.githubApiService = createHttpClient({
      baseURL: GITHUB_API_URL,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    });
  }

  loginWithGithub() {
    window.location.href = browserEnvConfig.NEXT_PUBLIC_GITHUB_APP_INSTALLATION_URL;
  }

  reLoginWithGithub() {
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${browserEnvConfig.NEXT_PUBLIC_GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URL}`;
  }

  async fetchUserProfile(token?: string | null) {
    const response = await this.githubApiService.get<GitHubProfile>("/user", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchRepos(token?: string | null) {
    const response = await this.githubApiService.get<GithubRepository[]>("/user/repos?per_page=150", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchBranches(repo?: string, token?: string | null) {
    const response = await this.githubApiService.get(`/repos/${repo}/branches`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchCommits(repo?: string, branch?: string, token?: string | null) {
    const response = await this.githubApiService.get<GitCommit[]>(`/repos/${repo}/commits?sha=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchPackageJson(repo?: string, subFolder?: string | undefined, token?: string | null) {
    const response = await this.githubApiService.get(`/repos/${repo}/contents/${subFolder ? `${subFolder}/` : ""}package.json`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchSrcFolders(repo: string, token?: string | null) {
    const response = await this.githubApiService.get(`/repos/${repo}/contents`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchAccessToken(code: string) {
    const response = await this.internalApiService.post(`/api/github/authenticate`, { code });
    return response.data;
  }
}
