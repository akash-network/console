import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useAtom } from "jotai";

import { BitbucketService } from "@src/services/remote-deploy/bitbucket-http.service";
import { tokens } from "@src/store/remoteDeployStore";
import { QueryKeys } from "./queryKeys";
const OAuthType = "bitbucket";
const bitbucketService = new BitbucketService();

export const useFetchRefreshBitToken = () => {
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
  const [token] = useAtom(tokens);

  const { mutate } = useFetchRefreshBitToken();

  const query = useQuery({
    queryKey: QueryKeys.getUserProfileKey(token.accessToken),
    queryFn: async () => bitbucketService.fetchUserProfile(token.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType
  });
  useEffect(() => {
    if (query.isError && (query.error as AxiosError)?.response?.status === 401) {
      mutate();
    }
  }, [query.isError, query.error, mutate]);

  return query;
};

export const useBitBucketCommits = (repo?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getCommitsKey(repo, token.accessToken),
    queryFn: async () => bitbucketService.fetchCommits(repo, token.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo
  });
};

export const useWorkspaces = () => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getWorkspacesKey(token.accessToken),
    queryFn: async () => bitbucketService.fetchWorkspaces(token.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType
  });
};

export const useBitReposByWorkspace = (workspace: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getReposByWorkspaceKey(workspace, token.accessToken),
    queryFn: async () => bitbucketService.fetchReposByWorkspace(workspace, token.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!workspace
  });
};

export const useBitBranches = (repo?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getBranchesKey(repo, token.accessToken),
    queryFn: async () => bitbucketService.fetchBranches(repo, token.accessToken),
    enabled: !!repo && !!token?.accessToken && token.type === OAuthType
  });
};

export const useBitPackageJson = (repo?: string, branch?: string, subFolder?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getPackageJsonKey(repo, branch, subFolder),
    queryFn: async () => bitbucketService.fetchPackageJson(repo, branch, subFolder, token.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo && !!branch
  });
};

export const useBitSrcFolders = (repo?: string, branch?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getSrcFoldersKey(repo, branch),
    queryFn: async () => bitbucketService.fetchSrcFolders(repo, branch, token.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo && !!branch
  });
};
