import { useMutation, useQuery } from "react-query";
import axios, { AxiosError } from "axios";
import { useAtom } from "jotai";
import { usePathname, useRouter } from "next/navigation";

import { CI_CD_TEMPLATE_ID, REDIRECT_URL } from "@src/config/remote-deploy.config";
import { tokens } from "@src/store/remoteDeployStore";
import { GitCommit } from "@src/types/remoteCommits";
import { GithubRepository, IGithubDirectoryItem, PackageJson } from "@src/types/remotedeploy";
import { GitHubProfile } from "@src/types/remoteProfile";
import { REDIRECT_URL } from "../utils";

const GITHUB_API_URL = "https://api.github.com";

export const handleLogin = () => {
  window.location.href = process.env.NEXT_PUBLIC_GITHUB_APP_INSTALLATION_URL as string;
};

export const handleReLogin = () => {
  window.location.href = `https://github.com/login/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URL}`;
};

const axiosInstance = axios.create({
  baseURL: GITHUB_API_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json"
  }
});

export const useUserProfile = () => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: ["userProfile", token?.access_token],
    queryFn: async () => {
      const response = await axiosInstance.get<GitHubProfile>("/user", {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "github"
  });
};

export const useRepos = () => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: ["repos", token?.access_token],
    queryFn: async () => {
      const response = await axiosInstance.get<GithubRepository[]>(
        "/user/repos?per_page=150",

        {
          headers: {
            Authorization: `Bearer ${token?.access_token}`
          }
        }
      );
      return response.data;
    },
    onError: (error: AxiosError<{ message: string }>) => {
      if (error?.response?.data?.message === "Bad credentials") {
        console.log("bad credentials");
      }
    },

    enabled: !!token?.access_token && token.type === "github"
  });
};

export const useFetchAccessToken = () => {
  const [, setToken] = useAtom(tokens);
  const pathname = usePathname();
  const router = useRouter();
  return useMutation({
    mutationFn: async (code: string) => {
      const response = await axios.post(`/api/github/authenticate`, {
        code
      });

      return response.data;
    },
    onSuccess: data => {
      setToken({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        type: "github"
      });
      router.replace(pathname.split("?")[0] + "?step=edit-deployment&type=github");
    }
  });
};

export const useBranches = (repo?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: ["branches", repo, token?.access_token],
    queryFn: async () => {
      const response = await axiosInstance.get(`/repos/${repo}/branches`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },

    enabled: !!token?.access_token && token.type === "github" && !!repo
  });
};

export const useCommits = (repo?: string, branch?: string) => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: ["commits", repo, branch, token?.access_token, repo, branch],
    queryFn: async () => {
      const response = await axiosInstance.get<GitCommit[]>(`/repos/${repo}/commits?sha=${branch}`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },

    enabled: !!token?.access_token && token.type === "github" && !!repo && !!branch
  });
};

export const usePackageJson = (onSettled: (data: PackageJson) => void, repo?: string, subFolder?: string) => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: ["packageJson", repo, subFolder],
    queryFn: async () => {
      const response = await axiosInstance.get(`/repos/${repo}/contents/${subFolder ? `${subFolder}/` : ""}package.json`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "github" && !!repo,
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
    queryKey: ["srcFolders", repo],
    queryFn: async () => {
      const response = await axiosInstance.get(`/repos/${repo}/contents`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "github" && !!repo,
    onSettled: data => {
      onSettled(data);
    }
  });
};
