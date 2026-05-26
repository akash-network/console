import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider";
import type { UseProviderCredentialsResult } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import { mapToBidDto } from "@src/queries/useBidQuery";
import type { useDeploymentDetail } from "@src/queries/useDeploymentQuery";
import type { LocalDeploymentData } from "@src/services/deployment-storage/deployment-storage.service";
import type { DeploymentDto, RpcBid } from "@src/types/deployment";
import type { ApiProviderDetail } from "@src/types/provider";
import { updateStorageWallets } from "@src/utils/walletUtils";
import { CreateLease, DEPENDENCIES as CREATE_LEASE_DEPENDENCIES } from "./CreateLease";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildRpcBid } from "@tests/seeders/bid";
import type { BlockDetail } from "@tests/seeders/block";
import { buildBlockDetail } from "@tests/seeders/block";
import { helloWorldManifest } from "@tests/seeders/manifest";
import { buildProvider } from "@tests/seeders/provider";
import { ComponentMock } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(CreateLease.name, () => {
  it("displays bids and a button to create a lease", async () => {
    const BidGroup = vi.fn(ComponentMock);
    const bids = [buildRpcBid({ bid: { id: { gseq: 1 }, state: "open" } }), buildRpcBid({ bid: { id: { gseq: 1 }, state: "open" } })];
    const { getByRole } = setup({
      BidGroup,
      bids
    });
    await vi.waitFor(() => {
      expect(getByRole("button", { name: /Accept Bid/i })).toBeInTheDocument();
      expect(BidGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          gseq: 1,
          bids: expect.arrayContaining(bids.map(mapToBidDto))
        }),
        {}
      );
      expect(BidGroup).toHaveBeenCalledTimes(1);
    });
  });

  it("groups bids by gseq", async () => {
    const BidGroup = vi.fn(ComponentMock);
    const bids = [buildRpcBid({ bid: { id: { gseq: 1 }, state: "open" } }), buildRpcBid({ bid: { id: { gseq: 2 }, state: "open" } })];
    const { getByRole } = setup({
      BidGroup,
      bids
    });
    await vi.waitFor(() => {
      expect(getByRole("button", { name: /Accept Bid/i })).toBeInTheDocument();
      expect(BidGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          gseq: 1,
          bids: bids.filter(b => b.bid.id.gseq === 1).map(mapToBidDto)
        }),
        {}
      );
      expect(BidGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          gseq: 2,
          bids: bids.filter(b => b.bid.id.gseq === 2).map(mapToBidDto)
        }),
        {}
      );
      expect(BidGroup).toHaveBeenCalledTimes(2);
    });
  });

  it("displays 'Close Deployment' button if all bids are closed", async () => {
    const bids = [buildRpcBid({ bid: { id: { gseq: 1 }, state: "closed" } }), buildRpcBid({ bid: { id: { gseq: 1 }, state: "closed" } })];
    const { getByRole, queryByRole } = setup({
      bids
    });
    await vi.waitFor(() => {
      expect(getByRole("button", { name: /Close Deployment/i })).toBeInTheDocument();
      expect(queryByRole("button", { name: /Accept Bid/i })).not.toBeInTheDocument();
    });
  });

  it("doesn't throw error if block is null-ish", async () => {
    vi.useFakeTimers();
    const { getByText } = setup({
      bids: [],
      isTrialWallet: true,
      getBlock: async () => null as any
    });
    await act(() => vi.runOnlyPendingTimersAsync());

    await vi.waitFor(() => {
      expect(getByText(/Waiting for bids/i)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it("disables Accept Bid button when blockchain is unavailable", async () => {
    const BidGroup = vi.fn(ComponentMock);
    const bids = [buildRpcBid({ bid: { id: { gseq: 1 }, state: "open" } }), buildRpcBid({ bid: { id: { gseq: 1 }, state: "open" } })];
    setup({
      BidGroup,
      bids,
      isBlockchainDown: true
    });

    await vi.waitFor(() => {
      expect(screen.getByText(/Blockchain is unavailable/i)).toBeInTheDocument();
    });
  });

  describe("lease creation", () => {
    it("creates lease on chain and submits manifest to provider with a JWT", async () => {
      const signAndBroadcastTx = vi.fn().mockResolvedValue({ code: 0 });
      const sendManifest = vi.fn();
      const ensureToken = vi.fn().mockResolvedValue("jwt-token");
      const dseq = "123";
      const selectedProvider = buildProvider();
      await setupLeaseCreation({ signAndBroadcastTx, sendManifest, ensureToken, dseq, selectedProvider });

      await vi.waitFor(() => {
        expect(screen.getByRole<HTMLButtonElement>("button", { name: /Accept Bid/i })).not.toBeDisabled();
      });

      await userEvent.click(screen.getByRole<HTMLButtonElement>("button", { name: /Accept Bid/i }));
      await vi.waitFor(() => {
        expect(signAndBroadcastTx).toHaveBeenCalledWith([
          expect.objectContaining({
            typeUrl: `/${MsgCreateLease.$type}`
          })
        ]);
        expect(ensureToken).toHaveBeenCalled();
        expect(sendManifest).toHaveBeenCalledWith(selectedProvider, expect.any(Array), {
          dseq,
          credentials: {
            type: "jwt",
            value: "jwt-token"
          }
        });
      });
    });

    it("sends manifest with refreshed JWT when 'Re-send Manifest' is clicked", async () => {
      const signAndBroadcastTx = vi.fn().mockResolvedValue({ code: 0 });
      const sendManifest = vi.fn();
      const ensureToken = vi.fn().mockResolvedValue("refreshed-token");
      const dseq = "123";
      const selectedProvider = buildProvider();
      const bids = [
        buildRpcBid({
          bid: {
            id: {
              gseq: 1,
              provider: selectedProvider.owner
            },
            state: "active"
          }
        })
      ];
      await setupLeaseCreation({
        bids,
        ensureToken,
        signAndBroadcastTx,
        sendManifest,
        dseq,
        selectedProvider
      });

      await vi.waitFor(() => {
        expect(screen.getByRole<HTMLButtonElement>("button", { name: /Re-send Manifest/i })).not.toBeDisabled();
      });

      await userEvent.click(screen.getByRole<HTMLButtonElement>("button", { name: /Re-send Manifest/i }));
      await vi.waitFor(() => {
        expect(ensureToken).toHaveBeenCalled();
        expect(sendManifest).toHaveBeenCalledWith(selectedProvider, expect.any(Array), {
          dseq,
          credentials: {
            type: "jwt",
            value: "refreshed-token"
          }
        });
      });
    });

    it("tracks create_lease with deployment resource amounts", async () => {
      const analyticsService = mock<AppDIContainer["analyticsService"]>();
      const dseq = "456";
      await setupLeaseCreation({
        dseq,
        deploymentDetail: { cpuAmount: 2, gpuAmount: 0, memoryAmount: 2_147_483_648, storageAmount: 10_737_418_240 },
        analyticsService
      });

      await vi.waitFor(() => {
        expect(screen.getByRole<HTMLButtonElement>("button", { name: /Accept Bid/i })).not.toBeDisabled();
      });

      await userEvent.click(screen.getByRole<HTMLButtonElement>("button", { name: /Accept Bid/i }));

      await vi.waitFor(() => {
        expect(analyticsService.track).toHaveBeenCalledWith("create_lease", {
          category: "deployments",
          label: "Create lease",
          dseq,
          cpuAmount: 2,
          gpuAmount: 0,
          memoryAmount: 2_147_483_648,
          storageAmount: 10_737_418_240
        });
        expect(analyticsService.track).not.toHaveBeenCalledWith("create_gpu_deployment", expect.anything());
      });
    });

    it("tracks create_gpu_deployment alongside create_lease when GPU is allocated", async () => {
      const analyticsService = mock<AppDIContainer["analyticsService"]>();
      const dseq = "789";
      await setupLeaseCreation({
        dseq,
        deploymentDetail: { cpuAmount: 4, gpuAmount: 2, memoryAmount: 17_179_869_184, storageAmount: 53_687_091_200 },
        analyticsService
      });

      await vi.waitFor(() => {
        expect(screen.getByRole<HTMLButtonElement>("button", { name: /Accept Bid/i })).not.toBeDisabled();
      });

      await userEvent.click(screen.getByRole<HTMLButtonElement>("button", { name: /Accept Bid/i }));

      const expectedProps = {
        category: "deployments",
        label: "Create lease",
        dseq,
        cpuAmount: 4,
        gpuAmount: 2,
        memoryAmount: 17_179_869_184,
        storageAmount: 53_687_091_200
      };

      await vi.waitFor(() => {
        expect(analyticsService.track).toHaveBeenCalledWith("create_lease", expectedProps);
        expect(analyticsService.track).toHaveBeenCalledWith("create_gpu_deployment", expectedProps);
      });
    });

    it("falls back to zero resource amounts on create_lease when deployment detail is unavailable", async () => {
      const analyticsService = mock<AppDIContainer["analyticsService"]>();
      const dseq = "321";
      await setupLeaseCreation({ dseq, deploymentDetail: null, analyticsService });

      await vi.waitFor(() => {
        expect(screen.getByRole<HTMLButtonElement>("button", { name: /Accept Bid/i })).not.toBeDisabled();
      });

      await userEvent.click(screen.getByRole<HTMLButtonElement>("button", { name: /Accept Bid/i }));

      await vi.waitFor(() => {
        expect(analyticsService.track).toHaveBeenCalledWith("create_lease", {
          category: "deployments",
          label: "Create lease",
          dseq,
          cpuAmount: 0,
          gpuAmount: 0,
          memoryAmount: 0,
          storageAmount: 0
        });
        expect(analyticsService.track).not.toHaveBeenCalledWith("create_gpu_deployment", expect.anything());
      });
    });

    async function setupLeaseCreation(input?: {
      bids?: RpcBid[];
      signAndBroadcastTx?: () => Promise<void>;
      sendManifest?: () => Promise<any>;
      ensureToken?: () => Promise<string>;
      dseq?: string;
      selectedProvider?: ApiProviderDetail;
      deploymentDetail?: Partial<DeploymentDto> | null;
      analyticsService?: AppDIContainer["analyticsService"];
    }) {
      const providers = [input?.selectedProvider ?? buildProvider(), buildProvider(), buildProvider()];
      const bids = input?.bids ?? [
        buildRpcBid({ bid: { id: { gseq: 1, provider: providers[0].owner }, state: "open" } }),
        buildRpcBid({ bid: { id: { gseq: 1, provider: providers[1].owner }, state: "open" } })
      ];
      const BidGroup = vi.fn(ComponentMock);
      const walletAddress = "akash123";

      setup({
        ...input,
        bids,
        BidGroup,
        walletAddress,
        providers,
        storedDeployment: {
          manifest: helloWorldManifest,
          manifestVersion: new Uint8Array([1, 2, 3]),
          name: "test deployment",
          owner: walletAddress
        }
      });

      await vi.waitFor(() => expect(BidGroup).toHaveBeenCalled());
      act(() => {
        updateStorageWallets([
          {
            address: walletAddress,
            isManaged: false,
            name: "test",
            selected: true
          }
        ]);
        const bidGroupProps = BidGroup.mock.calls[0][0];
        bidGroupProps.handleBidSelected(mapToBidDto(bids[0]));
      });
    }
  });

  function setup(input?: {
    dseq?: string;
    BidGroup?: (typeof CREATE_LEASE_DEPENDENCIES)["BidGroup"];
    bids?: RpcBid[];
    walletAddress?: string;
    signAndBroadcastTx?: () => Promise<void>;
    sendManifest?: () => Promise<any>;
    ensureToken?: () => Promise<string>;
    providers?: ApiProviderDetail[];
    isTrialWallet?: boolean;
    getBlock?: () => Promise<BlockDetail>;
    isBlockchainDown?: boolean;
    storedDeployment?: LocalDeploymentData;
    deploymentDetail?: Partial<DeploymentDto> | null;
    analyticsService?: AppDIContainer["analyticsService"];
  }) {
    const favoriteProviders: string[] = [];
    const useLocalNotes = (() => ({
      favoriteProviders
    })) as unknown as (typeof CREATE_LEASE_DEPENDENCIES)["useLocalNotes"];

    return render(
      <TestContainerProvider
        services={{
          networkStore: () =>
            mock<AppDIContainer["networkStore"]>({
              useSelectedNetworkId: () => "mainnet"
            }),
          providerProxy: () =>
            mock<AppDIContainer["providerProxy"]>({
              sendManifest: input?.sendManifest ?? (() => Promise.resolve({}))
            }),
          analyticsService: () => input?.analyticsService ?? mock<AppDIContainer["analyticsService"]>(),
          errorHandler: () => mock<AppDIContainer["errorHandler"]>(),
          chainApiHttpClient: () =>
            mock<AppDIContainer["chainApiHttpClient"]>({
              isFallbackEnabled: !!input?.isBlockchainDown,
              get: async url => {
                if (url.includes("bids/list")) {
                  return {
                    data: {
                      bids: input?.bids ?? [],
                      pagination: {
                        next_key: null,
                        total: String(input?.bids?.length ?? 0)
                      }
                    }
                  };
                }

                if (url.includes("/blocks/")) {
                  return {
                    data: input?.getBlock ? await input.getBlock() : buildBlockDetail()
                  };
                }

                throw new Error(`unexpected request: ${url}`);
              }
            } as AppDIContainer["chainApiHttpClient"]),
          publicConsoleApiHttpClient: () =>
            mock<AppDIContainer["publicConsoleApiHttpClient"]>({
              get: async (url: string) => {
                if (url.includes("/providers")) {
                  return {
                    data: input?.providers ?? [buildProvider(), buildProvider(), buildProvider()]
                  };
                }
                throw new Error(`unexpected request: ${url}`);
              }
            } as unknown as AppDIContainer["publicConsoleApiHttpClient"]),
          deploymentLocalStorage: () =>
            mock<AppDIContainer["deploymentLocalStorage"]>({
              get: (walletAddress, dseq) => {
                if (!walletAddress || !dseq) return null;
                return (
                  input?.storedDeployment ?? {
                    manifest: helloWorldManifest,
                    manifestVersion: new Uint8Array([1, 2, 3]),
                    name: "test deployment",
                    owner: walletAddress
                  }
                );
              }
            })
        }}
      >
        <CreateLease
          dseq={input?.dseq ?? "123"}
          dependencies={{
            ...CREATE_LEASE_DEPENDENCIES,
            BidGroup: input?.BidGroup ?? ComponentMock,
            CustomTooltip: ComponentMock,
            BidCountdownTimer: ComponentMock,
            useWallet: (() => ({
              address: input?.walletAddress ?? "akash123",
              walletName: "test",
              isWalletConnected: true,
              isWalletLoaded: true,
              isTrialing: input?.isTrialWallet ?? false,
              signAndBroadcastTx: input?.signAndBroadcastTx ?? (() => Promise.resolve({}))
            })) as unknown as (typeof CREATE_LEASE_DEPENDENCIES)["useWallet"],
            useProviderCredentials: () =>
              mock<UseProviderCredentialsResult>({
                details: {
                  type: "jwt",
                  value: "jwt-token",
                  isExpired: false,
                  usable: true
                },
                ensureToken: input?.ensureToken ?? (() => Promise.resolve("jwt-token"))
              }),
            useLocalNotes,
            useDeploymentDetail: (() =>
              mock<ReturnType<typeof useDeploymentDetail>>({
                data: input?.deploymentDetail ? (input.deploymentDetail as DeploymentDto) : null,
                refetch: vi.fn()
              })) as unknown as (typeof CREATE_LEASE_DEPENDENCIES)["useDeploymentDetail"],
            useRouter: () => mock(),
            useManagedDeploymentConfirm: () => ({
              closeDeploymentConfirm: () => Promise.resolve(true)
            }),
            useSettings: () => ({
              settings: {
                apiEndpoint: "https://api.example.com",
                rpcEndpoint: "https://rpc.example.com",
                isCustomNode: false,
                nodes: [],
                selectedNode: null,
                customNode: null,
                isBlockchainDown: input?.isBlockchainDown ?? false
              },
              setSettings: vi.fn(),
              isLoadingSettings: false,
              isSettingsInit: true,
              refreshNodeStatuses: vi.fn(),
              isRefreshingNodeStatus: false
            })
          }}
        />
      </TestContainerProvider>
    );
  }
});
