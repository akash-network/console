import { useMutation, useQuery } from "react-query";
import axios, { AxiosError } from "axios";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";

import { tokens } from "@src/store/remoteDeployStore";
import { BitBucketCommit } from "@src/types/remoteCommits";
import { IGithubDirectoryItem, PackageJson } from "@src/types/remotedeploy";
import { BitProfile } from "@src/types/remoteProfile";
import { BitRepository, BitWorkspace } from "@src/types/remoteRepos";
import { RouteStep } from "@src/types/route-steps.type";
import { UrlService } from "@src/utils/urlUtils";
import { ciCdTemplateId } from "../helper-functions";

const Bitbucket_API_URL = "https://api.bitbucket.org/2.0";

export const handleLoginBit = () => {
  window.location.href = `https://bitbucket.org/site/oauth2/authorize?client_id=${process.env.NEXT_PUBLIC_BITBUCKET_CLIENT_ID}&response_type=code`;
};
const axiosInstance = axios.create({
  baseURL: Bitbucket_API_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json"
  }
});

export const useFetchRefreshBitToken = () => {
  const [token, setToken] = useAtom(tokens);

  return useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/bitbucket/refresh`, {
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

export const useBitFetchAccessToken = () => {
  const [, setToken] = useAtom(tokens);

  const router = useRouter();
  return useMutation({
    mutationFn: async (code: string) => {
      const response = await axios.post(`/api/bitbucket/authenticate`, {
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

      router.replace(
        UrlService.newDeployment({
          step: RouteStep.editDeployment,
          gitProvider: "github",
          templateId: ciCdTemplateId
        })
      );
    }
  });
};

export const useBitUserProfile = () => {
  const [token] = useAtom(tokens);
  const { mutate } = useFetchRefreshBitToken();
  return useQuery({
    queryKey: ["userProfile", token.access_token],
    queryFn: async () => {
      const response = await axiosInstance.get<BitProfile>("/user", {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
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
  return useQuery({
    queryKey: ["commits", repo, token.access_token, repo],
    queryFn: async () => {
      const response = await axiosInstance.get<BitBucketCommit>(`/repositories/${repo}/commits`, {
        headers: {
          Authorization: `Bearer ${token?.access_token}`
        }
      });
      return response.data;
    },
    enabled: !!token?.access_token && token.type === "bitbucket" && !!repo
  });
};

export const useWorkspaces = () => {
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: ["workspaces", token.access_token],
    queryFn: async () => {
      const response = await axiosInstance.get<{
        values: BitWorkspace[];
      }>("/workspaces", {
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
  const [token] = useAtom(tokens);
  return useQuery({
    queryKey: ["repos", token.access_token, workspace],
    queryFn: async () => {
      const response = await axiosInstance.get<{
        values: BitRepository[];
      }>(`/repositories/${workspace}`, {
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
  const [token] = useAtom(tokens);
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

export const useBitPackageJson = (onSettled: (data: PackageJson) => void, repo?: string, branch?: string, subFolder?: string) => {
  const [token] = useAtom(tokens);

  return useQuery({
    queryKey: ["packageJson", repo, branch, subFolder],
    queryFn: async () => {
      const response = await axiosInstance.get(`/repositories/${repo}/src/${branch}/${subFolder ? `${subFolder}/` : ""}package.json`, {
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

export const useBitSrcFolders = (onSettled: (data: IGithubDirectoryItem[]) => void, repo?: string, branch?: string) => {
  const [token] = useAtom(tokens);

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
