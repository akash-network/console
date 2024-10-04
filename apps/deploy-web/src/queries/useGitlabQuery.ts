import { useMutation, useQuery } from "react-query";
import { AxiosError } from "axios";
import { useAtom } from "jotai";

import { GitLabService } from "@src/services/remote-deploy/gitlab-http.service";
import { tokens } from "@src/store/remoteDeployStore";
import { IGithubDirectoryItem, PackageJson } from "@src/types/remotedeploy";
import { QueryKeys } from "./queryKeys";

const gitLabService = new GitLabService();
const OAuthType = "gitlab";
export const useGitLabFetchAccessToken = (onSuccess: () => void) => {
  const [, setToken] = useAtom(tokens);

  return useMutation({
    mutationFn: (code: string) => gitLabService.fetchAccessToken(code),
    onSuccess: data => {
      setToken({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        type: OAuthType
      });

      onSuccess();
    }
  });
};

export const useFetchRefreshToken = () => {
  const [token, setToken] = useAtom(tokens);

  return useMutation({
    mutationFn: () => gitLabService.refreshToken(token?.refresh_token),
    onSuccess: data => {
      setToken({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        type: OAuthType
      });
    }
  });
};

export const useGitLabUserProfile = () => {
  const [token] = useAtom(tokens);
  const { mutate } = useFetchRefreshToken();

  return useQuery({
    queryKey: QueryKeys.getUserProfileKey(token?.access_token),
    queryFn: () => gitLabService.fetchUserProfile(token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType,
    onError: (error: AxiosError) => {
      if (error.response?.status === 401) {
        mutate();
      }
    }
  });
};

export const useGitLabGroups = () => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getGroupsKey(token?.access_token),
    queryFn: () => gitLabService.fetchGitLabGroups(token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType
  });
};

export const useGitLabReposByGroup = (group: string | undefined) => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getReposByGroupKey(group, token?.access_token),
    queryFn: () => gitLabService.fetchReposByGroup(group, token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType && !!group
  });
};

export const useGitLabBranches = (repo?: string) => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getBranchesKey(repo, token?.access_token),
    queryFn: () => gitLabService.fetchBranches(repo, token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType && !!repo
  });
};

export const useGitLabCommits = (repo?: string, branch?: string) => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getCommitsByBranchKey(repo, branch, token?.access_token),
    queryFn: () => gitLabService.fetchCommits(repo, branch, token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType && !!repo && !!branch
  });
};

export const useGitlabPackageJson = (onSettled: (data: PackageJson) => void, repo?: string, subFolder?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getPackageJsonKey(repo, "main", subFolder, token?.access_token),
    queryFn: () => gitLabService.fetchPackageJson(repo, subFolder, token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType && !!repo,
    onSettled: data => {
      if (data?.content === undefined) return;
      const content = atob(data.content);
      const parsed = JSON.parse(content);
      onSettled(parsed);
    }
  });
};

export const useGitlabSrcFolders = (onSettled: (data: IGithubDirectoryItem[]) => void, repo?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getSrcFoldersKey(repo, "main", token?.access_token),
    queryFn: () => gitLabService.fetchSrcFolders(repo, token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType && !!repo,
    onSettled: data => {
      onSettled(data);
    }
  });
};
