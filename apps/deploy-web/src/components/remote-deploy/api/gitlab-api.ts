import { useMutation, useQuery } from "react-query";
import axios from "axios";
import { useAtom } from "jotai";
import { usePathname, useRouter } from "next/navigation";

import remoteDeployStore from "@src/store/remoteDeployStore";
import { PROXY_API_URL_AUTH } from "../utils";

// ?step=edit-deployment&type=github
const CLIEND_ID = "f8b7584c38a6aaba2315e3c377513debd589e0a06bf15cc3fd96b1dd713b19ca";
const REDIRECT_URL = "https://akashconsole.vercel.app/new-deployment";

export const handleGitLabLogin = () => {
  window.location.href = `https://gitlab.com/oauth/authorize?client_id=${CLIEND_ID}&redirect_uri=${REDIRECT_URL}&response_type=code&scope=read_user+read_repository+read_api+api&state=gitlab`;
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
      const response = await axios.post(`${PROXY_API_URL_AUTH}/gitlab/authenticate`, {
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
      const response = await axios.post(`${PROXY_API_URL_AUTH}/gitlab/refresh`, {
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
      const response = await axiosInstance.get("/user", {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "gitlab",
    onError: (error: any) => {
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
      const response = await axiosInstance.get(`/groups`, {
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
      const response = await axiosInstance.get(`/groups/${group}/projects`, {
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
      const response = await axiosInstance.get(`/projects/${repo}/repository/commits?ref_name=${branch}`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },

    enabled: !!token?.access_token && token.type === "gitlab" && !!repo && !!branch
  });
};

export const useGitlabPackageJson = (onSettled: (data: any) => void, repo?: string) => {
  const [token] = useAtom(remoteDeployStore.tokens);
  console.log(repo);

  return useQuery({
    queryKey: ["packageJson", repo],
    queryFn: async () => {
      const response = await axiosInstance.get(`/projects/${repo}/repository/files/package.json/raw`, {
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
