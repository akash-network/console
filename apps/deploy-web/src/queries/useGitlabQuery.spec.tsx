import { faker } from "@faker-js/faker";
import type { AxiosError } from "axios";

import { GitLabService } from "@src/services/remote-deploy/gitlab-http.service";
import {
  useGitLabBranches,
  useGitLabCommits,
  useGitLabFetchAccessToken,
  useGitLabGroups,
  useGitlabPackageJson,
  useGitLabReposByGroup,
  useGitlabSrcFolders,
  useGitLabUserProfile
} from "./useGitlabQuery";

import { act, waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";
import { readToken, writeToken } from "@tests/unit/token";

jest.mock("@src/services/remote-deploy/gitlab-http.service", () => {
  const mockService = {
    fetchAccessToken: jest.fn().mockResolvedValue({
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token"
    }),
    refreshToken: jest.fn(),
    fetchUserProfile: jest.fn(),
    fetchGitLabGroups: jest.fn(),
    fetchReposByGroup: jest.fn(),
    fetchBranches: jest.fn(),
    fetchCommits: jest.fn(),
    fetchPackageJson: jest.fn(),
    fetchSrcFolders: jest.fn()
  };

  return {
    GitLabService: jest.fn(() => mockService)
  };
});

describe("useGitlabQuery", () => {
  let mockGitlabService: any;

  beforeEach(() => {
    mockGitlabService = new GitLabService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("useGitLabFetchAccessToken", () => {
    it("should fetch access token and update token state", async () => {
      const mockData = { accessToken: "test-access-token", refreshToken: "test-refresh-token" };
      mockGitlabService.fetchAccessToken.mockResolvedValue(mockData);
      const onSuccess = jest.fn();

      const { result } = setupQuery(() => useGitLabFetchAccessToken(onSuccess));

      await act(async () => {
        await result.current.mutateAsync("test-code");
      });

      await waitFor(() => {
        expect(mockGitlabService.fetchAccessToken).toHaveBeenCalledWith("test-code");
        expect(onSuccess).toHaveBeenCalled();
        expect(readToken()).toBe("test-access-token");
      });
    });
  });

  describe("useGitLabUserProfile", () => {
    it("should fetch user profile when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockData = { username: "test-username" };
      mockGitlabService.fetchUserProfile.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useGitLabUserProfile());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should attempt to refresh token on 401 error", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockError = { response: { status: 401 } } as AxiosError;
      const mockData = { username: "test-username" };
      mockGitlabService.fetchUserProfile.mockImplementation((token: string) => {
        if (token === "test-token") {
          return Promise.reject(mockError);
        }

        return Promise.resolve(mockData);
      });

      mockGitlabService.refreshToken.mockResolvedValueOnce({
        accessToken: "new-token",
        refreshToken: "new-refresh-token"
      });

      const { result } = setupQuery(() => useGitLabUserProfile());

      await waitFor(() => {
        expect(mockGitlabService.fetchUserProfile).toHaveBeenCalledWith("test-token");
        expect(mockGitlabService.refreshToken).toHaveBeenCalled();
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe("useGitLabCommits", () => {
    it("should fetch commits when repo and branch are provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockData = [{ hash: faker.git.commitSha() }];
      mockGitlabService.fetchCommits.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useGitLabCommits("test-repo", "main"));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(mockGitlabService.fetchCommits).toHaveBeenCalledWith("test-repo", "main", "test-token");
        expect(result.current.data).toEqual(mockData);
      });
    });
  });

  describe("useGitLabGroups", () => {
    it("should fetch groups when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockData = [{ id: faker.string.uuid() }];
      mockGitlabService.fetchGitLabGroups.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useGitLabGroups());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(mockGitlabService.fetchGitLabGroups).toHaveBeenCalledWith("test-token");
        expect(result.current.data).toEqual(mockData);
      });
    });
  });

  describe("useGitLabReposByGroup", () => {
    it("should fetch repos when group is provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockData = [{ name: faker.lorem.word() }];
      mockGitlabService.fetchReposByGroup.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useGitLabReposByGroup("test-group"));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(mockGitlabService.fetchReposByGroup).toHaveBeenCalledWith("test-group", "test-token");
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when group is not provided", () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });

      const { result } = setupQuery(() => useGitLabReposByGroup(undefined));
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useGitLabBranches", () => {
    it("should fetch branches when repo is provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockData = [{ name: faker.lorem.word() }];
      mockGitlabService.fetchBranches.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useGitLabBranches("test-repo"));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(mockGitlabService.fetchBranches).toHaveBeenCalledWith("test-repo", "test-token");
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when repo is not provided", () => {
      const { result } = setupQuery(() => useGitLabBranches());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useGitlabPackageJson", () => {
    it("should fetch package.json and call onSettled callback", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockPackageJson = { dependencies: ["foo", "bar"] };
      mockGitlabService.fetchPackageJson.mockResolvedValue({
        content: btoa(JSON.stringify(mockPackageJson))
      });
      const onSettled = jest.fn();

      const { result } = setupQuery(() => useGitlabPackageJson(onSettled, "test-repo", "src"));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(mockGitlabService.fetchPackageJson).toHaveBeenCalledWith("test-repo", "src", "test-token");
        expect(onSettled).toHaveBeenCalledWith(mockPackageJson);
      });
    });
  });

  describe("useGitlabSrcFolders", () => {
    it("should fetch source folders and call onSettled callback", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockFolders = [{ name: faker.lorem.word() }];
      mockGitlabService.fetchSrcFolders.mockResolvedValue(mockFolders);
      const onSettled = jest.fn();

      const { result } = setupQuery(() => useGitlabSrcFolders(onSettled, "test-repo"));

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(mockGitlabService.fetchSrcFolders).toHaveBeenCalledWith("test-repo", "test-token");
        expect(onSettled).toHaveBeenCalledWith(mockFolders);
      });
    });
  });
});
