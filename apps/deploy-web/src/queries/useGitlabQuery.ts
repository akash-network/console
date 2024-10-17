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
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        type: OAuthType
      });

      onSuccess();
    }
  });
};

export const useFetchRefreshToken = () => {
  const [token, setToken] = useAtom(tokens);

  return useMutation({
    mutationFn: () => gitLabService.refreshToken(token?.refreshToken),
    onSuccess: data => {
      setToken({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        type: OAuthType
      });
    }
  });
};

export const useGitLabUserProfile = () => {
  const [token] = useAtom(tokens);
  const { mutate } = useFetchRefreshToken();

  return useQuery({
    queryKey: QueryKeys.getUserProfileKey(token?.accessToken),
    queryFn: () => gitLabService.fetchUserProfile(token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType,
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
    queryKey: QueryKeys.getGroupsKey(token?.accessToken),
    queryFn: () => gitLabService.fetchGitLabGroups(token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType
  });
};

export const useGitLabReposByGroup = (group: string | undefined) => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getReposByGroupKey(group, token?.accessToken),
    queryFn: () => gitLabService.fetchReposByGroup(group, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!group
  });
};

export const useGitLabBranches = (repo?: string) => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getBranchesKey(repo, token?.accessToken),
    queryFn: () => gitLabService.fetchBranches(repo, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo
  });
};

export const useGitLabCommits = (repo?: string, branch?: string) => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getCommitsByBranchKey(repo, branch, token?.accessToken),
    queryFn: () => gitLabService.fetchCommits(repo, branch, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo && !!branch
  });
};

export const useGitlabPackageJson = (onSettled: (data: PackageJson) => void, repo?: string, subFolder?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getPackageJsonKey(repo, OAuthType, subFolder),
    queryFn: () => gitLabService.fetchPackageJson(repo, subFolder, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo,
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
    queryKey: QueryKeys.getSrcFoldersKey(repo, OAuthType),
    queryFn: () => gitLabService.fetchSrcFolders(repo, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo,
    onSettled: data => {
      onSettled(data);
    }
  });
};
