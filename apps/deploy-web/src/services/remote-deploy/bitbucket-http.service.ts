import axios from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { BitBucketCommit } from "@src/types/remoteCommits";
import { BitProfile } from "@src/types/remoteProfile";
import { BitRepository, BitWorkspace } from "@src/types/remoteRepos";

const BITBUCKET_API_URL = "https://api.bitbucket.org/2.0";

export class BitbucketService {
  private axiosInstance = axios.create({
    baseURL: BITBUCKET_API_URL,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    }
  });

  constructor() {}

  public handleLogin() {
    window.location.href = `https://bitbucket.org/site/oauth2/authorize?client_id=${browserEnvConfig.NEXT_PUBLIC_BITBUCKET_CLIENT_ID}&response_type=code`;
  }

  async fetchRefreshToken(refreshToken?: string | null) {
    const response = await this.axiosInstance.post(`/api/bitbucket/refresh`, { refreshToken });
    return response.data;
  }

  async fetchAccessToken(code: string) {
    const response = await axios.post(`/api/bitbucket/authenticate`, { code });
    return response.data;
  }

  async fetchUserProfile(accessToken?: string | null) {
    const response = await this.axiosInstance.get<BitProfile>("/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async fetchCommits(repo?: string, accessToken?: string | null) {
    const response = await this.axiosInstance.get<BitBucketCommit>(`/repositories/${repo}/commits`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async fetchWorkspaces(accessToken?: string | null) {
    const response = await this.axiosInstance.get<{ values: BitWorkspace[] }>("/workspaces", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async fetchReposByWorkspace(workspace: string, accessToken?: string | null) {
    const response = await this.axiosInstance.get<{ values: BitRepository[] }>(`/repositories/${workspace}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async fetchBranches(repo?: string, accessToken?: string | null) {
    const response = await this.axiosInstance.get(`/repositories/${repo}/refs/branches`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async fetchPackageJson(repo?: string, branch?: string, subFolder?: string | undefined, accessToken?: string | null) {
    const response = await this.axiosInstance.get(`/repositories/${repo}/src/${branch}/${subFolder ? `${subFolder}/` : ""}package.json`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }

  async fetchSrcFolders(repo?: string, branch?: string, accessToken?: string | null) {
    const response = await this.axiosInstance.get(`/repositories/${repo}/src/${branch}/.`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    return response.data;
  }
}
