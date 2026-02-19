import { faker } from "@faker-js/faker";
import type { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GitLabService } from "@src/services/remote-deploy/gitlab-http.service";
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

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";
import { readToken, writeToken } from "@tests/unit/token";

describe("useGitlabQuery", () => {
  describe("useGitLabFetchAccessToken", () => {
    it("fetches access token and update token state", async () => {
      const mockData = { accessToken: "test-access-token", refreshToken: "test-refresh-token" };
      const mockGitlabService = mock<GitLabService>({
        fetchAccessToken: vi.fn().mockResolvedValue(mockData)
      });
      const onSuccess = vi.fn();

      const { result } = setupQuery(() => useGitLabFetchAccessToken(onSuccess), {
        services: {
          gitlabService: () => mockGitlabService
        }
      });

      await act(async () => {
        await result.current.mutateAsync("test-code");
      });

      await vi.waitFor(() => {
        expect(mockGitlabService.fetchAccessToken).toHaveBeenCalledWith("test-code");
        expect(onSuccess).toHaveBeenCalled();
        expect(readToken()).toBe("test-access-token");
      });
    });
  });

  describe("useGitLabUserProfile", () => {
    it("fetches user profile when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockData = { username: "test-username" };
      const mockGitlabService = mock<GitLabService>({
        fetchUserProfile: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useGitLabUserProfile(), {
        services: {
          gitlabService: () => mockGitlabService
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("attempts to refresh token on 401 error", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockError = { response: { status: 401 } } as AxiosError;
      const mockData = { username: "test-username" };
      const mockGitlabService = mock<GitLabService>({
        fetchUserProfile: vi.fn().mockImplementation((token: string) => {
          if (token === "test-token") {
            return Promise.reject(mockError);
          }
          return Promise.resolve(mockData);
        }),
        refreshToken: vi.fn().mockResolvedValue({
          accessToken: "new-token",
          refreshToken: "new-refresh-token"
        })
      });

      const { result } = setupQuery(() => useGitLabUserProfile(), {
        services: {
          gitlabService: () => mockGitlabService
        }
      });

      await vi.waitFor(() => {
        expect(mockGitlabService.fetchUserProfile).toHaveBeenCalledWith("test-token");
        expect(mockGitlabService.refreshToken).toHaveBeenCalled();
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe("useGitLabCommits", () => {
    it("fetches commits when repo and branch are provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockData = [{ hash: faker.git.commitSha() }];
      const mockGitlabService = mock<GitLabService>({
        fetchCommits: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useGitLabCommits("test-repo", "main"), {
        services: {
          gitlabService: () => mockGitlabService
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(mockGitlabService.fetchCommits).toHaveBeenCalledWith("test-repo", "main", "test-token");
        expect(result.current.data).toEqual(mockData);
      });
    });
  });

  describe("useGitLabGroups", () => {
    it("fetches groups when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockData = [{ id: faker.string.uuid() }];
      const mockGitlabService = mock<GitLabService>({
        fetchGitLabGroups: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useGitLabGroups(), {
        services: {
          gitlabService: () => mockGitlabService
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(mockGitlabService.fetchGitLabGroups).toHaveBeenCalledWith("test-token");
        expect(result.current.data).toEqual(mockData);
      });
    });
  });

  describe("useGitLabReposByGroup", () => {
    it("fetches repos when group is provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockData = [{ name: faker.lorem.word() }];
      const mockGitlabService = mock<GitLabService>({
        fetchReposByGroup: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useGitLabReposByGroup("test-group"), {
        services: {
          gitlabService: () => mockGitlabService
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(mockGitlabService.fetchReposByGroup).toHaveBeenCalledWith("test-group", "test-token");
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when group is not provided", () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });

      const { result } = setupQuery(() => useGitLabReposByGroup(undefined));
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useGitLabBranches", () => {
    it("fetches branches when repo is provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockData = [{ name: faker.lorem.word() }];
      const mockGitlabService = mock<GitLabService>({
        fetchBranches: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useGitLabBranches("test-repo"), {
        services: {
          gitlabService: () => mockGitlabService
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(mockGitlabService.fetchBranches).toHaveBeenCalledWith("test-repo", "test-token");
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when repo is not provided", () => {
      const { result } = setupQuery(() => useGitLabBranches());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useGitlabPackageJson", () => {
    it("fetches package.json and call onSettled callback", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockPackageJson = { dependencies: ["foo", "bar"] };
      const onSettled = vi.fn();
      const mockGitlabService = mock<GitLabService>({
        fetchPackageJson: vi.fn().mockResolvedValue({
          content: btoa(JSON.stringify(mockPackageJson))
        })
      });

      const { result } = setupQuery(() => useGitlabPackageJson(onSettled, "test-repo", "src"), {
        services: {
          gitlabService: () => mockGitlabService
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(mockGitlabService.fetchPackageJson).toHaveBeenCalledWith("test-repo", "src", "test-token");
        expect(onSettled).toHaveBeenCalledWith(mockPackageJson);
      });
    });
  });

  describe("useGitlabSrcFolders", () => {
    it("fetches source folders and call onSettled callback", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "gitlab" });
      const mockFolders = [{ name: faker.lorem.word() }];
      const onSettled = vi.fn();
      const mockGitlabService = mock<GitLabService>({
        fetchSrcFolders: vi.fn().mockResolvedValue(mockFolders)
      });

      const { result } = setupQuery(() => useGitlabSrcFolders(onSettled, "test-repo"), {
        services: {
          gitlabService: () => mockGitlabService
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(mockGitlabService.fetchSrcFolders).toHaveBeenCalledWith("test-repo", "test-token");
        expect(onSettled).toHaveBeenCalledWith(mockFolders);
      });
    });
  });
});
