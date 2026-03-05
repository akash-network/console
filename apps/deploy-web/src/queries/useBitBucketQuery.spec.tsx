import { faker } from "@faker-js/faker";
import type { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BitbucketService } from "@src/services/remote-deploy/bitbucket-http.service";
import {
  useBitBranches,
  useBitBucketCommits,
  useBitFetchAccessToken,
  useBitPackageJson,
  useBitReposByWorkspace,
  useBitSrcFolders,
  useBitUserProfile,
  useWorkspaces
} from "./useBitBucketQuery";

import { act } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";
import { readToken, writeToken } from "@tests/unit/token";

describe("useBitBucketQuery", () => {
  describe("useBitFetchAccessToken", () => {
    it("fetches access token and update token state", async () => {
      const mockData = { accessToken: "test-access-token", refreshToken: "test-refresh-token" };
      const mockBitbucketService = mock<BitbucketService>({
        fetchAccessToken: vi.fn().mockResolvedValue(mockData)
      });
      const onSuccess = vi.fn();

      const { result } = setupQuery(() => useBitFetchAccessToken(onSuccess), {
        services: {
          bitbucketService: () => mockBitbucketService
        }
      });

      await act(async () => {
        await result.current.mutateAsync("test-code");
      });

      await vi.waitFor(() => {
        expect(mockBitbucketService.fetchAccessToken).toHaveBeenCalledWith("test-code");
        expect(onSuccess).toHaveBeenCalled();
        expect(readToken()).toBe(mockData.accessToken);
      });
    });
  });

  describe("useBitUserProfile", () => {
    it("fetches user profile when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockData = {
        display_name: "Test User",
        links: {
          self: { href: "https://api.bitbucket.org/2.0/user" },
          avatar: { href: "https://bitbucket.org/account/testuser/avatar/" },
          html: { href: "https://bitbucket.org/testuser" },
          hooks: { href: "https://api.bitbucket.org/2.0/user/hooks" }
        },
        created_on: "2023-01-01T00:00:00.000000+00:00",
        type: "user",
        uuid: "test-uuid",
        username: "test-username",
        account_id: "test-account-id",
        nickname: "testuser",
        account_status: "active",
        location: null
      };
      const mockBitbucketService = mock<BitbucketService>({
        fetchUserProfile: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useBitUserProfile(), {
        services: {
          bitbucketService: () => mockBitbucketService
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("attempts to refresh token on 401 error", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockError = { response: { status: 401 } } as AxiosError;
      const mockData = {
        display_name: "Test User",
        links: {
          self: { href: "https://api.bitbucket.org/2.0/user" },
          avatar: { href: "https://bitbucket.org/account/testuser/avatar/" },
          html: { href: "https://bitbucket.org/testuser" },
          hooks: { href: "https://api.bitbucket.org/2.0/user/hooks" }
        },
        created_on: "2023-01-01T00:00:00.000000+00:00",
        type: "user",
        uuid: "test-uuid",
        username: "test-username",
        account_id: "test-account-id",
        nickname: "testuser",
        account_status: "active",
        location: null
      };
      const mockBitbucketService = mock<BitbucketService>({
        fetchUserProfile: vi.fn().mockImplementation((token: string) => {
          if (token === "test-token") {
            return Promise.reject(mockError);
          }
          return Promise.resolve(mockData);
        }),
        fetchRefreshToken: vi.fn().mockResolvedValue({
          accessToken: "new-token",
          refreshToken: "new-refresh-token"
        })
      });

      const { result } = setupQuery(() => useBitUserProfile(), {
        services: {
          bitbucketService: () => mockBitbucketService
        }
      });

      await vi.waitFor(() => {
        expect(mockBitbucketService.fetchUserProfile).toHaveBeenCalledWith("test-token");
        expect(mockBitbucketService.fetchRefreshToken).toHaveBeenCalledWith("test-refresh-token");
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe("useBitBucketCommits", () => {
    it("fetches commits when repo is provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockData = { values: [{ hash: faker.git.commitSha() }] };
      const mockBitbucketService = mock<BitbucketService>({
        fetchCommits: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useBitBucketCommits("test-repo"), {
        services: {
          bitbucketService: () => mockBitbucketService
        }
      });

      await vi.waitFor(() => {
        expect(mockBitbucketService.fetchCommits).toHaveBeenCalledWith("test-repo", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when repo is not provided", () => {
      const { result } = setupQuery(() => useBitBucketCommits());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useWorkspaces", () => {
    it("fetches workspaces when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockData = { values: [{ uuid: faker.string.uuid() }] };
      const mockBitbucketService = mock<BitbucketService>({
        fetchWorkspaces: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useWorkspaces(), {
        services: {
          bitbucketService: () => mockBitbucketService
        }
      });

      await vi.waitFor(() => {
        expect(mockBitbucketService.fetchWorkspaces).toHaveBeenCalledWith("test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });
  });

  describe("useBitReposByWorkspace", () => {
    it("fetches repos when workspace is provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockData = { values: [{ name: faker.lorem.word() }] };
      const mockBitbucketService = mock<BitbucketService>({
        fetchReposByWorkspace: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useBitReposByWorkspace("test-workspace"), {
        services: {
          bitbucketService: () => mockBitbucketService
        }
      });

      await vi.waitFor(() => {
        expect(mockBitbucketService.fetchReposByWorkspace).toHaveBeenCalledWith("test-workspace", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when workspace is not provided", () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });

      const { result } = setupQuery(() => useBitReposByWorkspace(""));
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useBitBranches", () => {
    it("fetches branches when repo is provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockData = { values: [{ name: faker.lorem.word() }] };
      const mockBitbucketService = mock<BitbucketService>({
        fetchBranches: vi.fn().mockResolvedValue(mockData)
      });

      const { result } = setupQuery(() => useBitBranches("test-repo"), {
        services: {
          bitbucketService: () => mockBitbucketService
        }
      });

      await vi.waitFor(() => {
        expect(mockBitbucketService.fetchBranches).toHaveBeenCalledWith("test-repo", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("does not fetch when repo is not provided", () => {
      const { result } = setupQuery(() => useBitBranches());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useBitPackageJson", () => {
    it("fetches package.json and call onSettled callback", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockPackageJson = { dependencies: ["foo", "bar"] };
      const onSettled = vi.fn();
      const mockBitbucketService = mock<BitbucketService>({
        fetchPackageJson: vi.fn().mockResolvedValue(mockPackageJson)
      });

      const { result } = setupQuery(() => useBitPackageJson(onSettled, "test-repo", "main", "src"), {
        services: {
          bitbucketService: () => mockBitbucketService
        }
      });

      await vi.waitFor(() => {
        expect(mockBitbucketService.fetchPackageJson).toHaveBeenCalledWith("test-repo", "main", "src", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(onSettled).toHaveBeenCalledWith(mockPackageJson);
      });
    });
  });

  describe("useBitSrcFolders", () => {
    it("fetches source folders and call onSettled callback", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockFolders = [{ name: faker.lorem.word() }];
      const onSettled = vi.fn();
      const mockBitbucketService = mock<BitbucketService>({
        fetchSrcFolders: vi.fn().mockResolvedValue({ values: mockFolders })
      });

      const { result } = setupQuery(() => useBitSrcFolders(onSettled, "test-repo", "main"), {
        services: {
          bitbucketService: () => mockBitbucketService
        }
      });

      await vi.waitFor(() => {
        expect(mockBitbucketService.fetchSrcFolders).toHaveBeenCalledWith("test-repo", "main", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(onSettled).toHaveBeenCalledWith(mockFolders);
      });
    });
  });
});
