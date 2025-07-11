import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useAtom } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { tokens } from "@src/store/remoteDeployStore";
import type { IGithubDirectoryItem, PackageJson } from "@src/types/remotedeploy";
import type { GitLabProfile } from "@src/types/remoteProfile";
import { QueryKeys } from "./queryKeys";

const OAuthType = "gitlab";
export const useGitLabFetchAccessToken = (onSuccess: () => void) => {
  const { gitlabService } = useServices();
  const [, setToken] = useAtom(tokens);

  return useMutation({
    mutationFn: (code: string) => gitlabService.fetchAccessToken(code),
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
  const { gitlabService } = useServices();
  const [token, setToken] = useAtom(tokens);

  return useMutation({
    mutationFn: () => gitlabService.refreshToken(token?.refreshToken),
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
  const { gitlabService } = useServices();
  const [token] = useAtom(tokens);
  const { mutate } = useFetchRefreshToken();

  const query = useQuery<GitLabProfile, AxiosError>({
    queryKey: QueryKeys.getUserProfileKey(token?.accessToken),
    queryFn: () => gitlabService.fetchUserProfile(token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType
  });

  useEffect(() => {
    if (query.error?.response?.status === 401) {
      mutate();
    }
  }, [query.error, mutate]);

  return query;
};

export const useGitLabGroups = () => {
  const { gitlabService } = useServices();
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getGroupsKey(token?.accessToken),
    queryFn: () => gitlabService.fetchGitLabGroups(token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType
  });
};

export const useGitLabReposByGroup = (group: string | undefined) => {
  const { gitlabService } = useServices();
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getReposByGroupKey(group, token?.accessToken),
    queryFn: () => gitlabService.fetchReposByGroup(group, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!group
  });
};

export const useGitLabBranches = (repo?: string) => {
  const { gitlabService } = useServices();
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getBranchesKey(repo, token?.accessToken),
    queryFn: () => gitlabService.fetchBranches(repo, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo
  });
};

export const useGitLabCommits = (repo?: string, branch?: string) => {
  const { gitlabService } = useServices();
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getCommitsByBranchKey(repo, branch, token?.accessToken),
    queryFn: () => gitlabService.fetchCommits(repo, branch, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo && !!branch
  });
};

export const useGitlabPackageJson = (onSettled: (data: PackageJson) => void, repo?: string, subFolder?: string) => {
  const { gitlabService } = useServices();
  const [token] = useAtom(tokens);

  const query = useQuery({
    queryKey: QueryKeys.getPackageJsonKey(repo, OAuthType, subFolder),
    queryFn: () => gitlabService.fetchPackageJson(repo, subFolder, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo
  });

  useEffect(() => {
    if (query.data) {
      if (query.data?.content === undefined) {
        return;
      }

      const content = atob(query.data.content);
      const parsed = JSON.parse(content);
      onSettled(parsed);
    }
  }, [onSettled, query.data]);

  return query;
};

export const useGitlabSrcFolders = (onSettled: (data: IGithubDirectoryItem[]) => void, repo?: string) => {
  const { gitlabService } = useServices();
  const [token] = useAtom(tokens);

  const query = useQuery({
    queryKey: QueryKeys.getSrcFoldersKey(repo, OAuthType),
    queryFn: () => gitlabService.fetchSrcFolders(repo, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo
  });

  useEffect(() => {
    if (query.data) {
      onSettled(query.data);
    }
  }, [onSettled, query.data]);

  return query;
};
