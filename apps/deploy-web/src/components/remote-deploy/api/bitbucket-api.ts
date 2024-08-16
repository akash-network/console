import { useMutation, useQuery } from "react-query";
import axios from "axios";
import { useAtom } from "jotai";
import { usePathname, useRouter } from "next/navigation";

import remoteDeployStore from "@src/store/remoteDeployStore";
import { PROXY_API_URL_AUTH } from "../utils";

const Bitbucket_API_URL = "https://api.bitbucket.org/2.0";
const BitBucketKey = "HfxhSWx78u8juqs2Ta";

export const handleLoginBit = () => {
  window.location.href = `https://bitbucket.org/site/oauth2/authorize?client_id=${BitBucketKey}&response_type=code`;
};
const axiosInstance = axios.create({
  baseURL: Bitbucket_API_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json"
  }
});

export const useFetchRefreshBitToken = () => {
  const [token, setToken] = useAtom(remoteDeployStore.tokens);

  return useMutation({
    mutationFn: async () => {
      const response = await axios.post(`${PROXY_API_URL_AUTH}/bitbucket/refresh`, {
        refreshToken: token?.refresh_token
      });

      return response.data;
    },
    onSuccess: data => {
      setToken({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        type: "bitbucket"
      });
    }
  });
};

export const useBitUserProfile = () => {
  const [token] = useAtom(remoteDeployStore.tokens);
  const { mutate } = useFetchRefreshBitToken();
  return useQuery({
    queryKey: ["userProfile", token.access_token],
    queryFn: async () => {
      const response = await axiosInstance.get("/user", {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "bitbucket",
    onError: (error: any) => {
      if (error.response?.status === 401) {
        mutate();
      }
    }
  });
};

export const useBitBucketCommits = (repo?: string) => {
  const [token] = useAtom(remoteDeployStore.tokens);
  return useQuery({
    queryKey: ["commits", repo, token.access_token, repo],
    queryFn: async () => {
      const response = await axiosInstance.get(`/repositories/${repo}/commits`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "bitbucket" && !!repo
  });
};

export const useBitFetchAccessToken = () => {
  const [, setToken] = useAtom(remoteDeployStore.tokens);
  const pathname = usePathname();
  const router = useRouter();
  return useMutation({
    mutationFn: async (code: string) => {
      const response = await axios.post(`${PROXY_API_URL_AUTH}/bitbucket/authenticate`, {
        code
      });

      return response.data;
    },
    onSuccess: data => {
      setToken({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        type: "bitbucket"
      });

      router.replace(pathname.split("?")[0] + "?step=edit-deployment&type=github");
    }
  });
};

export const useWorkspaces = () => {
  const [token] = useAtom(remoteDeployStore.tokens);
  return useQuery({
    queryKey: ["workspaces", token.access_token],
    queryFn: async () => {
      const response = await axiosInstance.get("/workspaces", {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "bitbucket"
  });
};

export const useBitReposByWorkspace = (workspace: string) => {
  const [token] = useAtom(remoteDeployStore.tokens);
  return useQuery({
    queryKey: ["repos", token.access_token, workspace],
    queryFn: async () => {
      const response = await axiosInstance.get(`/repositories/${workspace}`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "bitbucket" && !!workspace
  });
};

export const useBitBranches = (repo?: string) => {
  const [token] = useAtom(remoteDeployStore.tokens);
  return useQuery({
    queryKey: ["branches", repo],
    queryFn: async () => {
      const response = await axiosInstance.get(`/repositories/${repo}/refs/branches`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!repo && !!token?.access_token && token.type === "bitbucket"
  });
};

export const useBitPackageJson = (onSettled: (data: any) => void, repo?: string, branch?: string) => {
  const [token] = useAtom(remoteDeployStore.tokens);

  return useQuery({
    queryKey: ["packageJson", repo, branch],
    queryFn: async () => {
      const response = await axiosInstance.get(`/repositories/${repo}/src/${branch}/package.json`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "bitbucket" && !!repo && !!branch,
    onSettled: data => {
      onSettled(data);
    }
  });
};

export const useBitSrcFolders = (onSettled: (data: any) => void, repo?: string, branch?: string) => {
  const [token] = useAtom(remoteDeployStore.tokens);
  console.log(repo, branch, "repo, branch");
  return useQuery({
    queryKey: ["src-folders-bit", repo, branch],
    // root folder
    queryFn: async () => {
      const response = await axiosInstance.get(`/repositories/${repo}/src/${branch}/.`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "bitbucket" && !!repo && !!branch,
    onSettled: data => {
      onSettled(data?.values);
    }
  });
};
