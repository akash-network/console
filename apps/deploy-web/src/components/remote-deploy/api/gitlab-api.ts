import { useMutation, useQuery } from "react-query";
import axios, { AxiosError } from "axios";
import { useAtom } from "jotai";
import { usePathname, useRouter } from "next/navigation";

import remoteDeployStore from "@src/store/remoteDeployStore";
import { GitLabCommit } from "@src/types/remoteCommits";
import { PackageJson } from "@src/types/remotedeploy";
import { GitLabProfile } from "@src/types/remoteProfile";
import { GitlabGroup, GitlabRepo } from "@src/types/remoteRepos";

export const handleGitLabLogin = () => {
  window.location.href = `https://gitlab.com/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GITLAB_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_REDIRECT_URI}&response_type=code&scope=read_user+read_repository+read_api+api&state=gitlab`;
};

const axiosInstance = axios.create({
  baseURL: "https://gitlab.com/api/v4",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json"
  }
});

export const useGitLabFetchAccessToken = () => {
  const [, setToken] = useAtom(remoteDeployStore.tokens);
  const pathname = usePathname();
  const router = useRouter();
  return useMutation({
    mutationFn: async (code: string) => {
      const response = await axios.post(`/api/gitlab/authenticate`, {
        code
      });

      return response.data;
    },
    onSuccess: data => {
      setToken({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        type: "gitlab"
      });

      router.replace(pathname.split("?")[0] + "?step=edit-deployment&type=github");
    }
  });
};

export const useFetchRefreshGitlabToken = () => {
  const [token, setToken] = useAtom(remoteDeployStore.tokens);

  return useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/gitlab/refresh`, {
        refreshToken: token?.refresh_token
      });

      return response.data;
    },
    onSuccess: data => {
      setToken({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        type: "gitlab"
      });
    }
  });
};

export const useGitLabUserProfile = () => {
  const [token] = useAtom(remoteDeployStore.tokens);

  const { mutate } = useFetchRefreshGitlabToken();

  return useQuery({
    queryKey: ["gitlab-user-Profile", token?.access_token],
    queryFn: async () => {
      const response = await axiosInstance.get<GitLabProfile>("/user", {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "gitlab",
    onError: (error: AxiosError) => {
      if (error.response?.status === 401) {
        mutate();
      }
    }
  });
};

export const useGitLabGroups = () => {
  const [token] = useAtom(remoteDeployStore.tokens);
  return useQuery({
    queryKey: ["gitlab-repos", token?.access_token],
    queryFn: async () => {
      const response = await axiosInstance.get<GitlabGroup[]>(`/groups`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "gitlab"
  });
};

export const useGitLabReposByGroup = (group: string | undefined) => {
  const [token] = useAtom(remoteDeployStore.tokens);
  return useQuery({
    queryKey: ["repos", token?.access_token, group],
    queryFn: async () => {
      const response = await axiosInstance.get<GitlabRepo[]>(`/groups/${group}/projects`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "gitlab" && !!group
  });
};

export const useGitLabBranches = (repo?: string) => {
  const [token] = useAtom(remoteDeployStore.tokens);
  return useQuery({
    queryKey: ["branches", repo],
    queryFn: async () => {
      const response = await axiosInstance.get(`/projects/${repo}/repository/branches`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "gitlab" && !!repo
  });
};

export const useGitLabCommits = (repo?: string, branch?: string) => {
  const [token] = useAtom(remoteDeployStore.tokens);
  return useQuery({
    queryKey: ["commits", repo, branch, token?.access_token, repo, branch],
    queryFn: async () => {
      const response = await axiosInstance.get<GitLabCommit[]>(`/projects/${repo}/repository/commits?ref_name=${branch}`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },

    enabled: !!token?.access_token && token.type === "gitlab" && !!repo && !!branch
  });
};

export const useGitlabPackageJson = (onSettled: (data: PackageJson) => void, repo?: string, subFolder?: string) => {
  const [token] = useAtom(remoteDeployStore.tokens);

  return useQuery({
    queryKey: ["packageJson-gitlab", repo, subFolder],
    queryFn: async () => {
      const response = await axiosInstance.get(`/projects/${repo}/repository/files/${subFolder ? `${subFolder}%2F` : ""}package.json?ref=main`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "gitlab" && !!repo,
    onSettled: data => {
      if (data?.content === undefined) return;
      const content = atob(data.content);
      const parsed = JSON.parse(content);
      onSettled(parsed);
    }
  });
};

export const useGitlabSrcFolders = (onSettled: (data: any) => void, repo?: string) => {
  const [token] = useAtom(remoteDeployStore.tokens);

  return useQuery({
    queryKey: ["src-folders-gitlab", repo],

    queryFn: async () => {
      const response = await axiosInstance.get(`/projects/${repo}/repository/tree`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "gitlab" && !!repo,
    onSettled: data => {
      onSettled(data);
    }
  });
};
