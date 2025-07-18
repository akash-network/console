import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useAtom } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { tokens } from "@src/store/remoteDeployStore";
import type { IGithubDirectoryItem, PackageJson } from "@src/types/remotedeploy";
import type { BitProfile } from "@src/types/remoteProfile";
import { QueryKeys } from "./queryKeys";

const OAuthType = "bitbucket";

const useFetchRefreshBitToken = () => {
  const { bitbucketService } = useServices();
  const [token, setToken] = useAtom(tokens);
  return useMutation({
    mutationFn: async () => bitbucketService.fetchRefreshToken(token?.refreshToken),
    onSuccess: data => {
      setToken({
        ...data,
        type: "bitbucket"
      });
    }
  });
};

export const useBitFetchAccessToken = (onSuccess: () => void) => {
  const { bitbucketService } = useServices();
  const [, setToken] = useAtom(tokens);

  return useMutation({
    mutationFn: async (code: string) => bitbucketService.fetchAccessToken(code),
    onSuccess: data => {
      setToken({
        ...data,
        type: OAuthType
      });

      onSuccess();
    }
  });
};

export const useBitUserProfile = () => {
  const { bitbucketService } = useServices();
  const [token] = useAtom(tokens);

  const { mutate } = useFetchRefreshBitToken();
  const query = useQuery<BitProfile, AxiosError>({
    queryKey: QueryKeys.getUserProfileKey(token.accessToken),
    queryFn: async () => bitbucketService.fetchUserProfile(token.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType
  });

  useEffect(() => {
    if (query.error?.response?.status === 401) {
      mutate();
    }
  }, [query.error, mutate]);

  return query;
};

export const useBitBucketCommits = (repo?: string) => {
  const { bitbucketService } = useServices();
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getCommitsKey(repo, token.accessToken),
    queryFn: async () => bitbucketService.fetchCommits(repo, token.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo
  });
};

export const useWorkspaces = () => {
  const { bitbucketService } = useServices();
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getWorkspacesKey(token.accessToken),
    queryFn: async () => bitbucketService.fetchWorkspaces(token.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType
  });
};

export const useBitReposByWorkspace = (workspace: string) => {
  const { bitbucketService } = useServices();
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getReposByWorkspaceKey(workspace, token.accessToken),
    queryFn: async () => bitbucketService.fetchReposByWorkspace(workspace, token.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!workspace
  });
};

export const useBitBranches = (repo?: string) => {
  const { bitbucketService } = useServices();
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getBranchesKey(repo, token.accessToken),
    queryFn: async () => bitbucketService.fetchBranches(repo, token.accessToken),
    enabled: !!repo && !!token?.accessToken && token.type === OAuthType
  });
};

export const useBitPackageJson = (onSettled: (data: PackageJson) => void, repo?: string, branch?: string, subFolder?: string) => {
  const { bitbucketService } = useServices();
  const [token] = useAtom(tokens);

  const query = useQuery({
    queryKey: QueryKeys.getPackageJsonKey(repo, branch, subFolder),
    queryFn: async () => bitbucketService.fetchPackageJson(repo, branch, subFolder, token.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo && !!branch
  });

  useEffect(() => {
    if (query.data) {
      onSettled(query.data);
    }
  }, [onSettled, query.data]);

  return query;
};

export const useBitSrcFolders = (onSettled: (data: IGithubDirectoryItem[]) => void, repo?: string, branch?: string) => {
  const { bitbucketService } = useServices();
  const [token] = useAtom(tokens);

  const query = useQuery({
    queryKey: QueryKeys.getSrcFoldersKey(repo, branch),

    queryFn: async () => bitbucketService.fetchSrcFolders(repo, branch, token.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo && !!branch
  });

  useEffect(() => {
    if (query.data) {
      onSettled(query.data?.values);
    }
  }, [onSettled, query.data]);

  return query;
};
