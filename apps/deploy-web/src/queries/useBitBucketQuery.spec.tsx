import { faker } from "@faker-js/faker";
import type { AxiosError } from "axios";

import { BitbucketService } from "@src/services/remote-deploy/bitbucket-http.service";
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

import { act, waitFor } from "@testing-library/react";
import { setupQuery } from "@tests/unit/query-client";
import { readToken, writeToken } from "@tests/unit/token";

jest.mock("@src/services/remote-deploy/bitbucket-http.service", () => {
  const mockService = {
    fetchAccessToken: jest.fn(),
    fetchRefreshToken: jest.fn(),
    fetchUserProfile: jest.fn(),
    fetchCommits: jest.fn(),
    fetchWorkspaces: jest.fn(),
    fetchReposByWorkspace: jest.fn(),
    fetchBranches: jest.fn(),
    fetchPackageJson: jest.fn(),
    fetchSrcFolders: jest.fn()
  };

  return {
    BitbucketService: jest.fn(() => mockService)
  };
});

describe("useBitBucketQuery", () => {
  let mockBitbucketService: any;

  beforeEach(() => {
    mockBitbucketService = new BitbucketService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("useBitFetchAccessToken", () => {
    it("should fetch access token and update token state", async () => {
      const mockData = { accessToken: "test-access-token", refreshToken: "test-refresh-token" };
      mockBitbucketService.fetchAccessToken.mockResolvedValue(mockData);
      const onSuccess = jest.fn();

      const { result } = setupQuery(() => useBitFetchAccessToken(onSuccess));

      await act(async () => {
        await result.current.mutateAsync("test-code");
      });

      await waitFor(() => {
        expect(mockBitbucketService.fetchAccessToken).toHaveBeenCalledWith("test-code");
        expect(onSuccess).toHaveBeenCalled();
        expect(readToken()).toBe(mockData.accessToken);
      });
    });
  });

  describe("useBitUserProfile", () => {
    it("should fetch user profile when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockData = { username: "test-username" };
      mockBitbucketService.fetchUserProfile.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useBitUserProfile());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should attempt to refresh token on 401 error", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockError = { response: { status: 401 } } as AxiosError;
      const mockData = { username: "test-username" };
      mockBitbucketService.fetchUserProfile.mockImplementation((token: string) => {
        if (token === "test-token") {
          return Promise.reject(mockError);
        }

        return Promise.resolve(mockData);
      });
      mockBitbucketService.fetchRefreshToken.mockResolvedValueOnce({
        accessToken: "new-token",
        refreshToken: "new-refresh-token"
      });

      const { result } = setupQuery(() => useBitUserProfile());

      await waitFor(() => {
        expect(mockBitbucketService.fetchUserProfile).toHaveBeenCalledWith("test-token");
        expect(mockBitbucketService.fetchRefreshToken).toHaveBeenCalledWith("test-refresh-token");
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe("useBitBucketCommits", () => {
    it("should fetch commits when repo is provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockData = { values: [{ hash: faker.git.commitSha() }] };
      mockBitbucketService.fetchCommits.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useBitBucketCommits("test-repo"));

      await waitFor(() => {
        expect(mockBitbucketService.fetchCommits).toHaveBeenCalledWith("test-repo", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when repo is not provided", () => {
      const { result } = setupQuery(() => useBitBucketCommits());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useWorkspaces", () => {
    it("should fetch workspaces when token is available", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockData = { values: [{ uuid: faker.string.uuid() }] };
      mockBitbucketService.fetchWorkspaces.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useWorkspaces());

      await waitFor(() => {
        expect(mockBitbucketService.fetchWorkspaces).toHaveBeenCalledWith("test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });
  });

  describe("useBitReposByWorkspace", () => {
    it("should fetch repos when workspace is provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockData = { values: [{ name: faker.lorem.word() }] };
      mockBitbucketService.fetchReposByWorkspace.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useBitReposByWorkspace("test-workspace"));

      await waitFor(() => {
        expect(mockBitbucketService.fetchReposByWorkspace).toHaveBeenCalledWith("test-workspace", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when workspace is not provided", () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });

      const { result } = setupQuery(() => useBitReposByWorkspace(""));
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useBitBranches", () => {
    it("should fetch branches when repo is provided", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockData = { values: [{ name: faker.lorem.word() }] };
      mockBitbucketService.fetchBranches.mockResolvedValue(mockData);

      const { result } = setupQuery(() => useBitBranches("test-repo"));

      await waitFor(() => {
        expect(mockBitbucketService.fetchBranches).toHaveBeenCalledWith("test-repo", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockData);
      });
    });

    it("should not fetch when repo is not provided", () => {
      const { result } = setupQuery(() => useBitBranches());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useBitPackageJson", () => {
    it("should fetch package.json and call onSettled callback", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockPackageJson = { dependencies: ["foo", "bar"] };
      mockBitbucketService.fetchPackageJson.mockResolvedValue(mockPackageJson);
      const onSettled = jest.fn();

      const { result } = setupQuery(() => useBitPackageJson(onSettled, "test-repo", "main", "src"));

      await waitFor(() => {
        expect(mockBitbucketService.fetchPackageJson).toHaveBeenCalledWith("test-repo", "main", "src", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(onSettled).toHaveBeenCalledWith(mockPackageJson);
      });
    });
  });

  describe("useBitSrcFolders", () => {
    it("should fetch source folders and call onSettled callback", async () => {
      writeToken({ accessToken: "test-token", refreshToken: "test-refresh-token", type: "bitbucket" });
      const mockFolders = [{ name: faker.lorem.word() }];
      mockBitbucketService.fetchSrcFolders.mockResolvedValue({ values: mockFolders });
      const onSettled = jest.fn();

      const { result } = setupQuery(() => useBitSrcFolders(onSettled, "test-repo", "main"));

      await waitFor(() => {
        expect(mockBitbucketService.fetchSrcFolders).toHaveBeenCalledWith("test-repo", "main", "test-token");
        expect(result.current.isSuccess).toBe(true);
        expect(onSettled).toHaveBeenCalledWith(mockFolders);
      });
    });
  });
});
