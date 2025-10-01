import type { ChainContext } from "@cosmos-kit/core";
import { mock } from "jest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider";
import type { ContextType as SettingsProviderContextType } from "@src/context/SettingsProvider/SettingsProviderContext";
import type { ContextType as WalletProviderContextType } from "@src/context/WalletProvider/WalletProvider";
import type { LocalWallet } from "@src/utils/walletUtils";
import { useJwt } from "./useJwt";

import { act, renderHook, waitFor } from "@testing-library/react";

describe(useJwt.name, () => {
  it("should return initial state when no address is provided", () => {
    const { result } = setup({
      address: "",
      isSettingsInit: true,
      wallets: []
    });

    expect(result.current.localToken).toBeNull();
    expect(result.current.isLocalTokenExpired).toBe(false);
    expect(result.current.isCreatingToken).toBe(false);
    expect(typeof result.current.createToken).toBe("function");
    expect(typeof result.current.setLocalToken).toBe("function");
  });

  it("should return initial state when settings are not initialized", () => {
    const { result } = setup({
      address: "akash123",
      isSettingsInit: false,
      wallets: []
    });

    expect(result.current.localToken).toBeNull();
    expect(result.current.isLocalTokenExpired).toBe(false);
    expect(result.current.isCreatingToken).toBe(false);
  });

  it("should load local token when address exists and settings are initialized", async () => {
    const mockToken = "mock-jwt-token";
    const address = "akash123";
    const wallets = [{ address, token: mockToken }] as LocalWallet[];

    const { result } = setup({
      address,
      isSettingsInit: true,
      wallets,
      mockDecodedToken: {
        exp: Math.floor(Date.now() / 1000) + 3600, // Not expired
        iat: Math.floor(Date.now() / 1000),
        iss: "https://example.com",
        version: "v1"
      }
    });

    await waitFor(() => {
      expect(result.current.localToken).toEqual({
        token: mockToken,
        address
      });
    });

    expect(result.current.isLocalTokenExpired).toBe(false);
  });

  it("should not load token when no matching wallet is found", async () => {
    const address = "akash123";
    const wallets = [{ address: "different-address", token: "some-token" }] as LocalWallet[];

    const { result } = setup({
      address,
      isSettingsInit: true,
      wallets
    });

    await waitFor(() => {
      expect(result.current.localToken).toBeNull();
    });

    expect(result.current.isLocalTokenExpired).toBe(false);
  });

  it("should handle wallet without token", async () => {
    const address = "akash123";
    const wallets = [{ address, token: undefined }] as LocalWallet[];

    const { result } = setup({
      address,
      isSettingsInit: true,
      wallets
    });

    await waitFor(() => {
      expect(result.current.localToken).toBeNull();
    });
  });

  it("should return null for localToken when token is expired", async () => {
    const mockToken = "mock-jwt-token";
    const address = "akash123";
    const wallets = [{ address, token: mockToken }] as LocalWallet[];

    const { result } = setup({
      address,
      isSettingsInit: true,
      wallets,
      mockDecodedToken: {
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired
        iat: Math.floor(Date.now() / 1000) - 7200,
        iss: "https://example.com",
        version: "v1"
      }
    });

    await waitFor(() => {
      expect(result.current.localToken).toBeNull();
    });

    expect(result.current.isLocalTokenExpired).toBe(true);
  });

  it("should return token when not expired", async () => {
    const mockToken = "mock-jwt-token";
    const address = "akash123";
    const wallets = [{ address, token: mockToken }] as LocalWallet[];

    const { result } = setup({
      address,
      isSettingsInit: true,
      wallets,
      mockDecodedToken: {
        exp: Math.floor(Date.now() / 1000) + 3600, // Not expired
        iat: Math.floor(Date.now() / 1000),
        iss: "https://example.com",
        version: "v1"
      }
    });

    await waitFor(() => {
      expect(result.current.localToken).toEqual({
        token: mockToken,
        address
      });
    });

    expect(result.current.isLocalTokenExpired).toBe(false);
  });

  it("should create token successfully", async () => {
    const address = "akash123";
    const mockToken = "new-jwt-token";

    const { result, mocks } = setup({
      address,
      isSettingsInit: true,
      wallets: [],
      mockCreatedToken: mockToken
    });

    await act(async () => {
      await result.current.createToken();
    });

    expect(mocks.useSelectedChain.getAccount).toHaveBeenCalled();
    expect(mocks.signAndBroadcastTx).toHaveBeenCalled();
    expect(mocks.updateWallet).toHaveBeenCalledWith(address, expect.any(Function));
    expect(mocks.analyticsService.track).toHaveBeenCalledWith("create_jwt", {
      category: "certificates",
      label: "Created jwt"
    });
    expect(result.current.isCreatingToken).toBe(false);
  });

  it("should handle token creation error", async () => {
    const address = "akash123";
    const error = new Error("Token creation failed");

    const { result } = setup({
      address,
      isSettingsInit: true,
      wallets: [],
      mockCreateTokenError: error
    });

    await expect(async () => {
      await act(async () => {
        await result.current.createToken();
      });
    }).rejects.toThrow("Token creation failed");

    expect(result.current.isCreatingToken).toBe(false);
  });

  it("should handle transaction broadcast failure", async () => {
    const address = "akash123";
    const mockToken = "new-jwt-token";

    const { result, mocks } = setup({
      address,
      isSettingsInit: true,
      wallets: [],
      mockCreatedToken: mockToken,
      mockSignAndBroadcastTxResponse: false
    });

    await act(async () => {
      await result.current.createToken();
    });

    expect(mocks.useSelectedChain.getAccount).toHaveBeenCalled();
    expect(mocks.signAndBroadcastTx).toHaveBeenCalled();
    expect(mocks.updateWallet).not.toHaveBeenCalled();
    expect(mocks.analyticsService.track).not.toHaveBeenCalled();
    expect(result.current.isCreatingToken).toBe(false);
  });

  it("should clear local token when setLocalToken is called with null", async () => {
    const { result } = setup({
      address: "akash123",
      isSettingsInit: true,
      wallets: []
    });

    await act(async () => {
      result.current.setLocalToken(null);
    });

    expect(result.current.localToken).toBeNull();
  });

  it("should handle multiple wallets and find correct one", async () => {
    const address = "akash123";
    const mockToken = "correct-token";
    const wallets = [
      { address: "akash111", token: "wrong-token-1" },
      { address: "akash222", token: "wrong-token-2" },
      { address, token: mockToken },
      { address: "akash333", token: "wrong-token-3" }
    ] as LocalWallet[];

    const { result } = setup({
      address,
      isSettingsInit: true,
      wallets,
      mockDecodedToken: {
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: "https://example.com",
        version: "v1"
      }
    });

    await waitFor(() => {
      expect(result.current.localToken).toEqual({
        token: mockToken,
        address
      });
    });
  });

  it("should handle JWT token decoding error gracefully", async () => {
    const mockToken = "invalid-jwt-token";
    const address = "akash123";
    const wallets = [{ address, token: mockToken }] as LocalWallet[];

    const { result } = setup({
      address,
      isSettingsInit: true,
      wallets,
      mockDecodeTokenError: new Error("Invalid JWT token")
    });

    await waitFor(() => {
      expect(result.current.localToken).toBeNull();
    });

    expect(result.current.isLocalTokenExpired).toBe(false);
  });

  function setup(input: {
    address?: string;
    isSettingsInit?: boolean;
    wallets?: Array<LocalWallet>;
    mockDecodedToken?: any;
    mockCreatedToken?: string;
    mockCreateTokenError?: Error;
    mockSignAndBroadcastTxResponse?: any;
    mockDecodeTokenError?: Error;
  }) {
    class MockJwtToken {
      createToken() {
        if (input.mockCreateTokenError) {
          throw input.mockCreateTokenError;
        }

        return input.mockCreatedToken ?? null;
      }

      decodeToken() {
        if (input.mockDecodeTokenError) {
          throw input.mockDecodeTokenError;
        }

        return input.mockDecodedToken ?? null;
      }
    }

    const mockUseSelectedChain = mock<ChainContext>({
      getAccount: jest.fn().mockResolvedValue({ pubkey: "mock-pubkey" }),
      signArbitrary: jest.fn().mockResolvedValue("mock-signature")
    });

    const mockAnalyticsService = mock<AppDIContainer["analyticsService"]>();
    const mockUseServices = mock<AppDIContainer>({
      analyticsService: mockAnalyticsService
    });

    const mockSignAndBroadcastTx = jest.fn().mockResolvedValue(input.mockSignAndBroadcastTxResponse ?? { success: true });
    const mockUseWallet = mock<WalletProviderContextType>({
      address: input.address ?? "",
      signAndBroadcastTx: mockSignAndBroadcastTx
    });

    const mockUseSettings = mock<SettingsProviderContextType>({
      settings: {
        apiEndpoint: "https://api.example.com",
        rpcEndpoint: "https://rpc.example.com",
        isCustomNode: false,
        nodes: [],
        selectedNode: null,
        customNode: null,
        isBlockchainDown: false
      }
    });

    const mockGetStorageWallets = jest.fn().mockReturnValue(input.wallets ?? []);

    const mockUpdateWallet = jest.fn().mockImplementation((address, updater) => {
      const wallet = { address, token: null };
      return updater(wallet);
    });

    const { result, rerender } = renderHook(() =>
      useJwt({
        dependencies: {
          useSelectedChain: () => mockUseSelectedChain,
          useServices: () => mockUseServices,
          useWallet: () => mockUseWallet,
          useSettings: () => mockUseSettings,
          getStorageWallets: mockGetStorageWallets,
          updateWallet: mockUpdateWallet,
          JwtToken: MockJwtToken as any
        }
      })
    );

    return {
      result,
      rerender,
      mocks: {
        useSelectedChain: mockUseSelectedChain,
        signAndBroadcastTx: mockSignAndBroadcastTx,
        analyticsService: mockAnalyticsService,
        getStorageWallets: mockGetStorageWallets,
        updateWallet: mockUpdateWallet
      }
    };
  }
});
