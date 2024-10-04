import axios from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { REDIRECT_URL } from "@src/config/remote-deploy.config";
import { GitCommit } from "@src/types/remoteCommits";
import { GithubRepository } from "@src/types/remotedeploy";
import { GitHubProfile } from "@src/types/remoteProfile";

const GITHUB_API_URL = "https://api.github.com";

const axiosInstance = axios.create({
  baseURL: GITHUB_API_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json"
  }
});

export class GitHubService {
  loginWithGithub() {
    window.location.href = browserEnvConfig.NEXT_PUBLIC_GITHUB_APP_INSTALLATION_URL;
  }

  reLoginWithGithub() {
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${browserEnvConfig.NEXT_PUBLIC_GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URL}`;
  }

  async fetchUserProfile(token?: string | null) {
    const response = await axiosInstance.get<GitHubProfile>("/user", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchRepos(token?: string | null) {
    const response = await axiosInstance.get<GithubRepository[]>("/user/repos?per_page=150", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchBranches(repo?: string, token?: string | null) {
    const response = await axiosInstance.get(`/repos/${repo}/branches`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchCommits(repo?: string, branch?: string, token?: string | null) {
    const response = await axiosInstance.get<GitCommit[]>(`/repos/${repo}/commits?sha=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchPackageJson(repo?: string, subFolder?: string | undefined, token?: string | null) {
    const response = await axiosInstance.get(`/repos/${repo}/contents/${subFolder ? `${subFolder}/` : ""}package.json`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchSrcFolders(repo: string, token?: string | null) {
    const response = await axiosInstance.get(`/repos/${repo}/contents`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async fetchAccessToken(code: string) {
    const response = await axios.post(`/api/github/authenticate`, { code });
    return response.data;
  }
}
