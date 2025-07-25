import type { AxiosInstance } from "axios";
import type axios from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";
import type { BitBucketCommit } from "@src/types/remoteCommits";
import type { BitProfile } from "@src/types/remoteProfile";
import type { BitRepository, BitWorkspace } from "@src/types/remoteRepos";

const BITBUCKET_API_URL = "https://api.bitbucket.org/2.0";

export class BitbucketService {
  private readonly bitbucketApiHttpClient: AxiosInstance;
  private readonly internalApiService: AxiosInstance;

  constructor(internalApiService: AxiosInstance, createHttpClient: typeof axios.create) {
    this.internalApiService = internalApiService;
    this.bitbucketApiHttpClient = createHttpClient({
      baseURL: BITBUCKET_API_URL,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    });
  }

  public loginWithBitBucket() {
    window.location.href = `https://bitbucket.org/site/oauth2/authorize?client_id=${browserEnvConfig.NEXT_PUBLIC_BITBUCKET_CLIENT_ID}&response_type=code`;
  }

  async fetchRefreshToken(refreshToken?: string | null) {
    const response = await this.internalApiService.post(`/api/bitbucket/refresh`, { refreshToken });
    return response.data;
  }

  async fetchAccessToken(code: string) {
    const response = await this.internalApiService.post(`/api/bitbucket/authenticate`, { code });
    return response.data;
  }

  async fetchUserProfile(accessToken?: string | null) {
    const response = await this.bitbucketApiHttpClient.get<BitProfile>("/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async fetchCommits(repo?: string, accessToken?: string | null) {
    const response = await this.bitbucketApiHttpClient.get<BitBucketCommit>(`/repositories/${repo}/commits`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async fetchWorkspaces(accessToken?: string | null) {
    const response = await this.bitbucketApiHttpClient.get<{ values: BitWorkspace[] }>("/workspaces", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async fetchReposByWorkspace(workspace: string, accessToken?: string | null) {
    const response = await this.bitbucketApiHttpClient.get<{ values: BitRepository[] }>(`/repositories/${workspace}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async fetchBranches(repo?: string, accessToken?: string | null) {
    const response = await this.bitbucketApiHttpClient.get(`/repositories/${repo}/refs/branches`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async fetchPackageJson(repo?: string, branch?: string, subFolder?: string | undefined, accessToken?: string | null) {
    const response = await this.bitbucketApiHttpClient.get(`/repositories/${repo}/src/${branch}/${subFolder ? `${subFolder}/` : ""}package.json`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async fetchSrcFolders(repo?: string, branch?: string, accessToken?: string | null) {
    const response = await this.bitbucketApiHttpClient.get(`/repositories/${repo}/src/${branch}/.`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }
}
