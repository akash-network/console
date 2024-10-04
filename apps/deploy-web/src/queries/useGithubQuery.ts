import { useMutation, useQuery } from "react-query";
import { useAtom } from "jotai";

import { GitHubService } from "@src/services/remote-deploy/github-http.service";
import { tokens } from "@src/store/remoteDeployStore";
import { IGithubDirectoryItem, PackageJson } from "@src/types/remotedeploy";
import { QueryKeys } from "./queryKeys";

const githubService = new GitHubService();
const OAuthType = "github";
export const useUserProfile = () => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getUserProfileKey(token.access_token),
    queryFn: () => githubService.fetchUserProfile(token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType
  });
};

export const useRepos = () => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getReposKey(token.access_token),
    queryFn: () => githubService.fetchRepos(token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType
  });
};

export const useBranches = (repo?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getBranchesKey(repo, token?.access_token),
    queryFn: () => githubService.fetchBranches(repo!, token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType && !!repo
  });
};

export const useCommits = (repo?: string, branch?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getCommitsByBranchKey(repo, branch, token?.access_token),
    queryFn: () => githubService.fetchCommits(repo!, branch!, token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType && !!repo && !!branch
  });
};

export const usePackageJson = (onSettled: (data: PackageJson) => void, repo?: string, subFolder?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getPackageJsonKey(repo, "main", subFolder, token?.access_token),
    queryFn: () => githubService.fetchPackageJson(repo!, subFolder, token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType && !!repo,
    onSettled: data => {
      if (data?.content === undefined) return;
      const content = atob(data.content);
      const parsed = JSON.parse(content);
      onSettled(parsed);
    }
  });
};

export const useSrcFolders = (onSettled: (data: IGithubDirectoryItem[]) => void, repo?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getSrcFoldersKey(repo, "main", token?.access_token),
    queryFn: () => githubService.fetchSrcFolders(repo!, token?.access_token),
    enabled: !!token?.access_token && token.type === OAuthType && !!repo,
    onSettled: data => {
      onSettled(data);
    }
  });
};

export const useFetchAccessToken = (onSuccess: () => void) => {
  const [, setToken] = useAtom(tokens);

  return useMutation({
    mutationFn: async (code: string) => {
      return githubService.fetchAccessToken(code);
    },
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
