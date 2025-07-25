import type { AxiosInstance } from "axios";
import type axios from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";
import type { GitLabCommit } from "@src/types/remoteCommits";
import type { GitLabProfile } from "@src/types/remoteProfile";
import type { GitlabGroup, GitlabRepo } from "@src/types/remoteRepos";

export class GitLabService {
  private readonly gitlabApiService: AxiosInstance;
  private readonly internalApiService: AxiosInstance;

  constructor(internalApiService: AxiosInstance, createHttpClient: typeof axios.create) {
    this.internalApiService = internalApiService;
    this.gitlabApiService = createHttpClient({
      baseURL: "https://gitlab.com/api/v4",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    });
  }

  public loginWithGitLab() {
    window.location.href = `https://gitlab.com/oauth/authorize?client_id=${browserEnvConfig.NEXT_PUBLIC_GITLAB_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_REDIRECT_URI}&response_type=code&scope=read_user+read_repository+read_api+api&state=gitlab`;
  }

  public async fetchAccessToken(code: string) {
    const response = await this.internalApiService.post(`/api/gitlab/authenticate`, { code });
    return response.data;
  }

  public async refreshToken(refreshToken?: string | null) {
    const response = await this.internalApiService.post(`/api/gitlab/refresh`, { refreshToken });
    return response.data;
  }

  public async fetchUserProfile(token?: string | null) {
    const response = await this.gitlabApiService.get<GitLabProfile>("/user", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  public async fetchGitLabGroups(token?: string | null) {
    const response = await this.gitlabApiService.get<GitlabGroup[]>(`/groups`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  public async fetchReposByGroup(group: string | undefined, token?: string | null) {
    const response = await this.gitlabApiService.get<GitlabRepo[]>(`/groups/${group}/projects`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  public async fetchBranches(repo: string | undefined, token?: string | null) {
    const response = await this.gitlabApiService.get(`/projects/${repo}/repository/branches`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  public async fetchCommits(repo: string | undefined, branch: string | undefined, token?: string | null) {
    const response = await this.gitlabApiService.get<GitLabCommit[]>(`/projects/${repo}/repository/commits?ref_name=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  public async fetchPackageJson(repo: string | undefined, subFolder: string | undefined, token?: string | null) {
    const response = await this.gitlabApiService.get(`/projects/${repo}/repository/files/${subFolder ? `${subFolder}%2F` : ""}package.json?ref=main`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  public async fetchSrcFolders(repo: string | undefined, token?: string | null) {
    const response = await this.gitlabApiService.get(`/projects/${repo}/repository/tree`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }
}
