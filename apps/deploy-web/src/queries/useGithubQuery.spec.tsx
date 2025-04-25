import { faker } from "@faker-js/faker";

import { GitHubService } from "@src/services/remote-deploy/github-http.service";
import { useBranches, useCommits, useFetchAccessToken, usePackageJson, useRepos, useSrcFolders, useUserProfile } from "./useGithubQuery";

import { act, waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";
import { readToken, writeToken } from "@tests/unit/token";

jest.mock("@src/services/remote-deploy/github-http.service", () => {
  const mockService = {
    fetchAccessToken: jest.fn(),
    fetchUserProfile: jest.fn(),
    fetchRepos: jest.fn(),
    fetchBranches: jest.fn(),
    fetchCommits: jest.fn(),
    fetchPackageJson: jest.fn(),
    fetchSrcFolders: jest.fn()
  };

  return {
    GitHubService: jest.fn(() => mockService)
  };
});

describe("useGithubQuery", () => {
  let mockGithubService: any;

  beforeEach(() => {
    mockGithubService = new GitHubService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("useFetchAccessToken", () => {
    it("should fetch access token and update token state", async () => {
      const mockData = { accessToken: "test-access-token", refreshToken: "test-refresh-token" };
      mockGithubService.fetchAccessToken.mockResolvedValue(mockData);
      const onSuccess = jest.fn();

      const { result } = setupQuery(() => useFetchAccessToken(onSuccess));

      await act(async () => {
        await result.current.mutateAsync("test-code");
      });

      await waitFor(() => {
        expect(mockGithubService.fetchAccessToken).toHaveBeenCalledWith("test-code");
        expect(onSuccess).toHaveBeenCalled();
        expect(readToken()).toBe(mockData.accessToken);
      });
    });
  });

  describe("useUserProfile", () => {
    it("should fetch user profile when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockData = { username: "test-username" };
      mockGithubService.fetchUserProfile.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useUserProfile());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });
  });

  describe("useRepos", () => {
    it("should fetch repos when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockData = [{ name: faker.lorem.word() }];
      mockGithubService.fetchRepos.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useRepos());

      await waitFor(() => {
        expect(mockGithubService.fetchRepos).toHaveBeenCalledWith("test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });
  });

  describe("useBranches", () => {
    it("should fetch branches when repo is provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockData = [{ name: faker.lorem.word() }];
      mockGithubService.fetchBranches.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useBranches("test-repo"));

      await waitFor(() => {
        expect(mockGithubService.fetchBranches).toHaveBeenCalledWith("test-repo", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when repo is not provided", () => {
      const { result } = setupQuery(() => useBranches());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useCommits", () => {
    it("should fetch commits when repo and branch are provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockData = [{ sha: faker.git.commitSha() }];
      mockGithubService.fetchCommits.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useCommits("test-repo", "main"));

      await waitFor(() => {
        expect(mockGithubService.fetchCommits).toHaveBeenCalledWith("test-repo", "main", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when repo or branch is not provided", () => {
      const { result } = setupQuery(() => useCommits());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("usePackageJson", () => {
    it("should fetch package.json and call onSuccess callback", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockPackageJson = { content: btoa(JSON.stringify({ dependencies: ["foo", "bar"] })) };
      mockGithubService.fetchPackageJson.mockResolvedValue(mockPackageJson);
      const onSuccess = jest.fn();

      const { result } = setupQuery(() => usePackageJson(onSuccess, "test-repo", "src"));

      await waitFor(() => {
        expect(mockGithubService.fetchPackageJson).toHaveBeenCalledWith("test-repo", "src", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(onSuccess).toHaveBeenCalledWith({ dependencies: ["foo", "bar"] });
      });
    });
  });

  describe("useSrcFolders", () => {
    it("should fetch source folders and call onSettled callback", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockFolders = [{ name: faker.lorem.word() }];
      mockGithubService.fetchSrcFolders.mockResolvedValue(mockFolders);
      const onSettled = jest.fn();

      const { result } = setupQuery(() => useSrcFolders(onSettled, "test-repo"));

      await waitFor(() => {
        expect(mockGithubService.fetchSrcFolders).toHaveBeenCalledWith("test-repo", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(onSettled).toHaveBeenCalledWith(mockFolders);
      });
    });
  });
});
