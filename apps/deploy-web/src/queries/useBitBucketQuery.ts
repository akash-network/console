import { useMutation, useQuery } from "react-query";
import { AxiosError } from "axios";
import { useAtom } from "jotai";

import { BitbucketService } from "@src/services/remote-deploy/bitbucket-http.service";
import { tokens } from "@src/store/remoteDeployStore";
import { IGithubDirectoryItem, PackageJson } from "@src/types/remotedeploy";
import { QueryKeys } from "./queryKeys";

export const useFetchRefreshBitToken = () => {
  const [token, setToken] = useAtom(tokens);
  const bitbucketService = new BitbucketService();
  return useMutation({
    mutationFn: async () => bitbucketService.fetchRefreshToken(token?.refresh_token),
    onSuccess: data => {
      setToken({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        type: "bitbucket"
      });
    }
  });
};

export const useBitFetchAccessToken = (onSuccess: () => void) => {
  const [, setToken] = useAtom(tokens);
  const bitbucketService = new BitbucketService();

  return useMutation({
    mutationFn: async (code: string) => bitbucketService.fetchAccessToken(code),
    onSuccess: data => {
      setToken({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        type: "bitbucket"
      });

      onSuccess();
    }
  });
};

export const useBitUserProfile = () => {
  const [token] = useAtom(tokens);
  const bitbucketService = new BitbucketService();
  const { mutate } = useFetchRefreshBitToken();
  return useQuery({
    queryKey: QueryKeys.getUserProfileKey(token.access_token),
    queryFn: async () => bitbucketService.fetchUserProfile(token.access_token),
    enabled: !!token?.access_token && token.type === "bitbucket",
    onError: (error: AxiosError) => {
      if (error.response?.status === 401) {
        mutate();
      }
    }
  });
};

export const useBitBucketCommits = (repo?: string) => {
  const [token] = useAtom(tokens);
  const bitbucketService = new BitbucketService();
  return useQuery({
    queryKey: QueryKeys.getCommitsKey(repo, token.access_token),
    queryFn: async () => bitbucketService.fetchCommits(repo, token.access_token),
    enabled: !!token?.access_token && token.type === "bitbucket" && !!repo
  });
};

export const useWorkspaces = () => {
  const [token] = useAtom(tokens);
  const bitbucketService = new BitbucketService();
  return useQuery({
    queryKey: QueryKeys.getWorkspacesKey(token.access_token),
    queryFn: async () => bitbucketService.fetchWorkspaces(token.access_token),
    enabled: !!token?.access_token && token.type === "bitbucket"
  });
};

export const useBitReposByWorkspace = (workspace: string) => {
  const [token] = useAtom(tokens);
  const bitbucketService = new BitbucketService();
  return useQuery({
    queryKey: QueryKeys.getReposByWorkspaceKey(workspace, token.access_token),
    queryFn: async () => bitbucketService.fetchReposByWorkspace(workspace, token.access_token),
    enabled: !!token?.access_token && token.type === "bitbucket" && !!workspace
  });
};

export const useBitBranches = (repo?: string) => {
  const [token] = useAtom(tokens);
  const bitbucketService = new BitbucketService();
  return useQuery({
    queryKey: QueryKeys.getBranchesKey(repo, token.access_token),
    queryFn: async () => bitbucketService.fetchBranches(repo, token.access_token),
    enabled: !!repo && !!token?.access_token && token.type === "bitbucket"
  });
};

export const useBitPackageJson = (onSettled: (data: PackageJson) => void, repo?: string, branch?: string, subFolder?: string) => {
  const [token] = useAtom(tokens);
  const bitbucketService = new BitbucketService();
  return useQuery({
    queryKey: QueryKeys.getPackageJsonKey(repo, branch, subFolder, token.access_token),
    queryFn: async () => bitbucketService.fetchPackageJson(repo, branch, subFolder, token.access_token),
    enabled: !!token?.access_token && token.type === "bitbucket" && !!repo && !!branch,
    onSettled: data => {
      onSettled(data);
    }
  });
};

export const useBitSrcFolders = (onSettled: (data: IGithubDirectoryItem[]) => void, repo?: string, branch?: string) => {
  const [token] = useAtom(tokens);
  const bitbucketService = new BitbucketService();
  return useQuery({
    queryKey: QueryKeys.getSrcFoldersKey(repo, branch, token.access_token),

    queryFn: async () => bitbucketService.fetchSrcFolders(repo, branch, token.access_token),
    enabled: !!token?.access_token && token.type === "bitbucket" && !!repo && !!branch,
    onSettled: data => {
      onSettled(data?.values);
    }
  });
};
