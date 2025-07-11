import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { tokens } from "@src/store/remoteDeployStore";
import type { IGithubDirectoryItem, PackageJson } from "@src/types/remotedeploy";
import { QueryKeys } from "./queryKeys";

const OAuthType = "github";
export const useUserProfile = () => {
  const { githubService } = useServices();
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getUserProfileKey(token.accessToken),
    queryFn: () => githubService.fetchUserProfile(token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType
  });
};

export const useRepos = () => {
  const { githubService } = useServices();
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getReposKey(token.accessToken),
    queryFn: () => githubService.fetchRepos(token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType
  });
};

export const useBranches = (repo?: string) => {
  const { githubService } = useServices();
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getBranchesKey(repo, token?.accessToken),
    queryFn: () => githubService.fetchBranches(repo!, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo
  });
};

export const useCommits = (repo?: string, branch?: string) => {
  const { githubService } = useServices();
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getCommitsByBranchKey(repo, branch, token?.accessToken),
    queryFn: () => githubService.fetchCommits(repo!, branch!, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo && !!branch
  });
};

export const usePackageJson = (onSuccess: (data: PackageJson) => void, repo?: string, subFolder?: string) => {
  const { githubService } = useServices();
  const [token] = useAtom(tokens);

  const query = useQuery({
    queryKey: QueryKeys.getPackageJsonKey(repo, OAuthType, subFolder),
    queryFn: () => githubService.fetchPackageJson(repo, subFolder, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo
  });

  useEffect(() => {
    if (query.data) {
      if (query.data?.content === undefined) {
        return;
      }

      const content = atob(query.data.content);
      const parsed = JSON.parse(content);

      onSuccess(parsed);
    }
  }, [onSuccess, query.data]);

  return query;
};

export const useSrcFolders = (onSettled: (data: IGithubDirectoryItem[]) => void, repo?: string) => {
  const { githubService } = useServices();
  const [token] = useAtom(tokens);

  const query = useQuery({
    queryKey: QueryKeys.getSrcFoldersKey(repo, OAuthType),
    queryFn: () => githubService.fetchSrcFolders(repo!, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo
  });

  useEffect(() => {
    if (query.data) {
      onSettled(query.data);
    }
  }, [onSettled, query.data]);

  return query;
};

export const useFetchAccessToken = (onSuccess: () => void) => {
  const { githubService } = useServices();
  const [, setToken] = useAtom(tokens);

  return useMutation({
    mutationFn: async (code: string) => {
      return githubService.fetchAccessToken(code);
    },
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
