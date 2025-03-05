import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";

import { GitHubService } from "@src/services/remote-deploy/github-http.service";
import { tokens } from "@src/store/remoteDeployStore";
import { QueryKeys } from "./queryKeys";

const githubService = new GitHubService();
const OAuthType = "github";
export const useUserProfile = () => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getUserProfileKey(token.accessToken),
    queryFn: () => githubService.fetchUserProfile(token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType
  });
};

export const useRepos = () => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: QueryKeys.getReposKey(token.accessToken),
    queryFn: () => githubService.fetchRepos(token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType
  });
};

export const useBranches = (repo?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getBranchesKey(repo, token?.accessToken),
    queryFn: () => githubService.fetchBranches(repo!, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo
  });
};

export const useCommits = (repo?: string, branch?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getCommitsByBranchKey(repo, branch, token?.accessToken),
    queryFn: () => githubService.fetchCommits(repo!, branch!, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo && !!branch
  });
};

export const usePackageJson = (repo?: string, subFolder?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getPackageJsonKey(repo, OAuthType, subFolder),
    queryFn: () => githubService.fetchPackageJson(repo, subFolder, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo
  });
};

export const useSrcFolders = (repo?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: QueryKeys.getSrcFoldersKey(repo, OAuthType),
    queryFn: () => githubService.fetchSrcFolders(repo!, token?.accessToken),
    enabled: !!token?.accessToken && token.type === OAuthType && !!repo
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
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        type: OAuthType
      });

      onSuccess();
    }
  });
};
