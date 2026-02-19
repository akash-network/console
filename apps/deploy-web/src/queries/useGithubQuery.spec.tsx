import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GitHubService } from "@src/services/remote-deploy/github-http.service";
import { useBranches, useCommits, useFetchAccessToken, useInstallations, usePackageJson, useRepos, useSrcFolders, useUserProfile } from "./useGithubQuery";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";
import { readToken, writeToken } from "@tests/unit/token";

describe("useGithubQuery", () => {
  describe("useFetchAccessToken", () => {
    it("fetches access token and update token state", async () => {
      const mockData = { accessToken: "test-access-token", refreshToken: "test-refresh-token" };
      const mockGithubService = mock<GitHubService>({
        fetchAccessToken: vi.fn().mockResolvedValue(mockData)
      });
      const onSuccess = vi.fn();

      const { result } = setupQuery(() => useFetchAccessToken(onSuccess), {
        services: {
          githubService: () => mockGithubService
        }
      });

      await act(async () => {
        await result.current.mutateAsync("test-code");
      });

      await vi.waitFor(() => {
        expect(mockGithubService.fetchAccessToken).toHaveBeenCalledWith("test-code");
        expect(onSuccess).toHaveBeenCalled();
        expect(readToken()).toBe(mockData.accessToken);
      });
    });
  });

  describe("useUserProfile", () => {
    it("fetches user profile when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockData = { username: "test-username" };
      const mockGithubService = mock<GitHubService>({
        fetchUserProfile: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useUserProfile(), {
        services: {
          githubService: () => mockGithubService
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });
  });

  describe("useRepos", () => {
    it("fetches repos when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockData = [{ name: faker.lorem.word() }];
      const installationsIds = [faker.number.int()];
      const mockGithubService = mock<GitHubService>({
        fetchRepos: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useRepos(installationsIds), {
        services: {
          githubService: () => mockGithubService
        }
      });

      await vi.waitFor(() => {
        expect(mockGithubService.fetchRepos).toHaveBeenCalledWith(installationsIds, "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });
  });

  describe("useInstallations", () => {
    it("fetches installations when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockData = [faker.number.int()];
      const mockGithubService = mock<GitHubService>({
        fetchInstallationIds: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useInstallations(), {
        services: {
          githubService: () => mockGithubService
        }
      });

      await vi.waitFor(() => {
        expect(mockGithubService.fetchInstallationIds).toHaveBeenCalledWith("test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });
  });

  describe("useBranches", () => {
    it("fetches branches when repo is provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockData = [{ name: faker.lorem.word() }];
      const mockGithubService = mock<GitHubService>({
        fetchBranches: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useBranches("test-repo"), {
        services: {
          githubService: () => mockGithubService
        }
      });

      await vi.waitFor(() => {
        expect(mockGithubService.fetchBranches).toHaveBeenCalledWith("test-repo", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when repo is not provided", () => {
      const { result } = setupQuery(() => useBranches());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useCommits", () => {
    it("fetches commits when repo and branch are provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockData = [{ sha: faker.git.commitSha() }];
      const mockGithubService = mock<GitHubService>({
        fetchCommits: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useCommits("test-repo", "main"), {
        services: {
          githubService: () => mockGithubService
        }
      });

      await vi.waitFor(() => {
        expect(mockGithubService.fetchCommits).toHaveBeenCalledWith("test-repo", "main", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when repo or branch is not provided", () => {
      const { result } = setupQuery(() => useCommits());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("usePackageJson", () => {
    it("fetches package.json and call onSuccess callback", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockPackageJson = { content: btoa(JSON.stringify({ dependencies: ["foo", "bar"] })) };
      const onSuccess = vi.fn();
      const mockGithubService = mock<GitHubService>({
        fetchPackageJson: vi.fn().mockResolvedValue(mockPackageJson)
      });

      const { result } = setupQuery(() => usePackageJson(onSuccess, "test-repo", "src"), {
        services: {
          githubService: () => mockGithubService
        }
      });

      await vi.waitFor(() => {
        expect(mockGithubService.fetchPackageJson).toHaveBeenCalledWith("test-repo", "src", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(onSuccess).toHaveBeenCalledWith({ dependencies: ["foo", "bar"] });
      });
    });
  });

  describe("useSrcFolders", () => {
    it("fetches source folders and call onSettled callback", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "github" });
      const mockFolders = [{ name: faker.lorem.word() }];
      const onSettled = vi.fn();
      const mockGithubService = mock<GitHubService>({
        fetchSrcFolders: vi.fn().mockResolvedValue(mockFolders)
      });

      const { result } = setupQuery(() => useSrcFolders(onSettled, "test-repo"), {
        services: {
          githubService: () => mockGithubService
        }
      });

      await vi.waitFor(() => {
        expect(mockGithubService.fetchSrcFolders).toHaveBeenCalledWith("test-repo", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(onSettled).toHaveBeenCalledWith(mockFolders);
      });
    });
  });
});
