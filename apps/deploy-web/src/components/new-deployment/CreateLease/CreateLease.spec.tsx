import { MsgCreateCertificate } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCreateLease } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { CertificatePem } from "@akashnetwork/chain-sdk/web";
import { mock } from "jest-mock-extended";

import type { ContextType as CertificateContextType, LocalCert } from "@src/context/CertificateProvider/CertificateProviderContext";
import type { AppDIContainer } from "@src/context/ServicesProvider";
import type { useFlag } from "@src/hooks/useFlag";
import { mapToBidDto } from "@src/queries/useBidQuery";
import type { RpcBid } from "@src/types/deployment";
import type { ApiProviderDetail } from "@src/types/provider";
import { saveDeploymentManifestAndName } from "@src/utils/deploymentLocalDataUtils";
import { updateStorageWallets } from "@src/utils/walletUtils";
import { CreateLease, DEPENDENCIES as CREATE_LEASE_DEPENDENCIES } from "./CreateLease";

import { act, render, screen, waitFor } from "@testing-library/react";
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
    const BidGroup = jest.fn(ComponentMock);
    const bids = [
      buildRpcBid({
        bid: {
          id: {
            gseq: 1
          },
          state: "open"
        }
      }),
      buildRpcBid({
        bid: {
          id: {
            gseq: 1
          },
          state: "open"
        }
      })
    ];
    const { getByRole } = setup({
      BidGroup,
      bids
    });
    await waitFor(() => {
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
    const BidGroup = jest.fn(ComponentMock);
    const bids = [
      buildRpcBid({
        bid: {
          id: {
            gseq: 1
          },
          state: "open"
        }
      }),
      buildRpcBid({
        bid: {
          id: {
            gseq: 2
          },
          state: "open"
        }
      })
    ];
    const { getByRole } = setup({
      BidGroup,
      bids
    });
    await waitFor(() => {
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
    const bids = [
      buildRpcBid({
        bid: {
          id: {
            gseq: 1
          },
          state: "closed"
        }
      }),
      buildRpcBid({
        bid: {
          id: {
            gseq: 1
          },
          state: "closed"
        }
      })
    ];
    const { getByRole, queryByRole } = setup({
      bids
    });
    await waitFor(() => {
      expect(getByRole("button", { name: /Close Deployment/i })).toBeInTheDocument();
      expect(queryByRole("button", { name: /Accept Bid/i })).not.toBeInTheDocument();
    });
  });

  it("doesn't throw error if block is null-ish", async () => {
    jest.useFakeTimers();
    const { getByText } = setup({
      bids: [],
      isTrialWallet: true,
      getBlock: async () => null as any
    });
    await act(() => jest.runOnlyPendingTimersAsync());

    await waitFor(() => {
      expect(getByText(/Waiting for bids/i)).toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it("disables Accept Bid button when blockchain is unavailable", async () => {
    const BidGroup = jest.fn(ComponentMock);
    const bids = [
      buildRpcBid({
        bid: {
          id: {
            gseq: 1
          },
          state: "open"
        }
      }),
      buildRpcBid({
        bid: {
          id: {
            gseq: 1
          },
          state: "open"
        }
      })
    ];
    setup({
      BidGroup,
      bids,
      isBlockchainDown: true
    });

    await waitFor(() => {
      expect(screen.getByText(/Blockchain is unavailable/i)).toBeInTheDocument();
    });
  });

  describe("lease creation", () => {
    it("creates lease on chain and submits manifest to provider", async () => {
      const signAndBroadcastTx = jest.fn().mockResolvedValue({ code: 0 });
      const sendManifest = jest.fn();
      const localCert: CertificateContextType["localCert"] = {
        certPem: "certPem",
        keyPem: "keyPem",
        address: "akash123"
      };
      const dseq = "123";
      const selectedProvider = buildProvider();
      await setupLeaseCreation({ signAndBroadcastTx, sendManifest, localCert, dseq, selectedProvider });

      await waitFor(() => {
        expect(screen.getByRole<HTMLButtonElement>("button", { name: /Accept Bid/i })).not.toBeDisabled();
      });

      await userEvent.click(screen.getByRole<HTMLButtonElement>("button", { name: /Accept Bid/i }));
      await waitFor(() => {
        expect(signAndBroadcastTx).toHaveBeenCalledWith([
          expect.objectContaining({
            typeUrl: `/${MsgCreateLease.$type}`
          })
        ]);
        expect(sendManifest).toHaveBeenCalledWith(selectedProvider, expect.any(Array), {
          dseq,
          chainNetwork: "mainnet",
          credentials: {
            type: "mtls",
            value: {
              cert: localCert.certPem,
              key: localCert.keyPem
            }
          }
        });
      });
    });

    it("creates new certificate on lease creation if there is no local certificate or it is expired", async () => {
      const signAndBroadcastTx = jest.fn().mockResolvedValue({ code: 0 });
      const sendManifest = jest.fn();
      const dseq = "123";
      const selectedProvider = buildProvider();
      const newPemCert: CertificatePem = {
        cert: "certPem",
        publicKey: "publicKey",
        privateKey: "privateKey"
      };
      const genNewCertificateIfLocalIsInvalid = jest.fn().mockResolvedValue(newPemCert);
      const localCert = {
        certPem: newPemCert.cert,
        keyPem: newPemCert.privateKey,
        address: "akash123"
      };
      const updateSelectedCertificate = jest.fn().mockResolvedValue(localCert);
      await setupLeaseCreation({
        genNewCertificateIfLocalIsInvalid,
        updateSelectedCertificate,
        signAndBroadcastTx,
        sendManifest,
        localCert: null,
        dseq,
        selectedProvider
      });

      await waitFor(() => {
        expect(screen.getByRole<HTMLButtonElement>("button", { name: /Accept Bid/i })).not.toBeDisabled();
      });

      await userEvent.click(screen.getByRole<HTMLButtonElement>("button", { name: /Accept Bid/i }));
      await waitFor(() => {
        expect(signAndBroadcastTx).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              typeUrl: `/${MsgCreateCertificate.$type}`
            }),
            expect.objectContaining({
              typeUrl: `/${MsgCreateLease.$type}`
            })
          ])
        );
        expect(sendManifest).toHaveBeenCalledWith(selectedProvider, expect.any(Array), {
          dseq,
          chainNetwork: "mainnet",
          credentials: {
            type: "mtls",
            value: {
              cert: localCert.certPem,
              key: localCert.keyPem
            }
          }
        });
      });
    });

    it("creates certificate when 'Re-send Manifest' is clicked and certificate is expired", async () => {
      const signAndBroadcastTx = jest.fn().mockResolvedValue({ code: 0 });
      const sendManifest = jest.fn();
      const dseq = "123";
      const selectedProvider = buildProvider();
      const newPemCert: CertificatePem = {
        cert: "certPem",
        publicKey: "publicKey",
        privateKey: "privateKey"
      };
      const genNewCertificateIfLocalIsInvalid = jest.fn().mockResolvedValue(newPemCert);
      const localCert = {
        certPem: newPemCert.cert,
        keyPem: newPemCert.privateKey,
        address: "akash123"
      };
      const updateSelectedCertificate = jest.fn().mockResolvedValue(localCert);
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
        genNewCertificateIfLocalIsInvalid,
        updateSelectedCertificate,
        signAndBroadcastTx,
        sendManifest,
        dseq,
        selectedProvider
      });

      await waitFor(() => {
        expect(screen.getByRole<HTMLButtonElement>("button", { name: /Re-send Manifest/i })).not.toBeDisabled();
      });

      await userEvent.click(screen.getByRole<HTMLButtonElement>("button", { name: /Re-send Manifest/i }));
      await waitFor(() => {
        expect(signAndBroadcastTx).toHaveBeenCalledWith([
          expect.objectContaining({
            typeUrl: `/${MsgCreateCertificate.$type}`
          })
        ]);
        expect(sendManifest).toHaveBeenCalledWith(selectedProvider, expect.any(Array), {
          dseq,
          chainNetwork: "mainnet",
          credentials: {
            type: "mtls",
            value: {
              cert: localCert.certPem,
              key: localCert.keyPem
            }
          }
        });
      });
    });

    async function setupLeaseCreation(input?: {
      bids?: RpcBid[];
      signAndBroadcastTx?: () => Promise<void>;
      sendManifest?: () => Promise<any>;
      localCert?: CertificateContextType["localCert"];
      dseq?: string;
      selectedProvider?: ApiProviderDetail;
      genNewCertificateIfLocalIsInvalid?: () => Promise<CertificatePem | null>;
      updateSelectedCertificate?: (cert: CertificatePem) => Promise<LocalCert>;
    }) {
      const providers = [input?.selectedProvider ?? buildProvider(), buildProvider(), buildProvider()];
      const bids = input?.bids ?? [
        buildRpcBid({
          bid: {
            id: {
              gseq: 1,
              provider: providers[0].owner
            },
            state: "open"
          }
        }),
        buildRpcBid({
          bid: {
            id: {
              gseq: 1,
              provider: providers[1].owner
            },
            state: "open"
          }
        })
      ];
      const BidGroup = jest.fn(ComponentMock);
      const walletAddress = input?.localCert?.address ?? "akash123";
      const dseq = input?.dseq ?? "123";

      setup({
        ...input,
        bids,
        BidGroup,
        walletAddress,
        localCert: input?.localCert,
        providers
      });

      await waitFor(() => expect(BidGroup).toHaveBeenCalled());
      act(() => {
        updateStorageWallets([
          {
            address: walletAddress,
            isManaged: false,
            name: "test",
            selected: true
          }
        ]);
        saveDeploymentManifestAndName(dseq, helloWorldManifest, new Uint8Array([1, 2, 3]), walletAddress, "test deployment");
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
    localCert?: CertificateContextType["localCert"];
    sendManifest?: () => Promise<any>;
    providers?: ApiProviderDetail[];
    genNewCertificateIfLocalIsInvalid?: () => Promise<CertificatePem | null>;
    updateSelectedCertificate?: (cert: CertificatePem) => Promise<LocalCert>;
    isTrialWallet?: boolean;
    getBlock?: () => Promise<BlockDetail>;
    isBlockchainDown?: boolean;
  }) {
    const favoriteProviders: string[] = [];
    const useLocalNotes = (() => ({
      favoriteProviders
    })) as unknown as (typeof CREATE_LEASE_DEPENDENCIES)["useLocalNotes"];
    const mockUseFlag = jest.fn((flag: string) => {
      if (flag === "anonymous_free_trial") {
        return true;
      }
      return false;
    }) as unknown as ReturnType<typeof useFlag>;

    // initAkashTypes({
    //   deploymentVersion: "v1beta4",
    //   marketVersion: "v1beta5",
    //   escrowVersion: "v1",
    //   certVersion: "v1",
    //   providerVersion: "v1beta4",
    //   networkId: "mainnet"
    // });

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
          analyticsService: () => mock<AppDIContainer["analyticsService"]>(),
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
            } as unknown as AppDIContainer["publicConsoleApiHttpClient"])
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
            useCertificate: () =>
              mock<CertificateContextType>({
                localCert: input?.localCert ?? null,
                genNewCertificateIfLocalIsInvalid: input?.genNewCertificateIfLocalIsInvalid ?? (() => Promise.resolve(null)),
                updateSelectedCertificate:
                  input?.updateSelectedCertificate ??
                  (cert =>
                    Promise.resolve({
                      certPem: cert.cert,
                      keyPem: cert.privateKey,
                      address: input?.walletAddress ?? "akash123"
                    } as LocalCert))
              }) as unknown as CertificateContextType,
            useLocalNotes,
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
              setSettings: jest.fn(),
              isLoadingSettings: false,
              isSettingsInit: true,
              refreshNodeStatuses: jest.fn(),
              isRefreshingNodeStatus: false
            }),
            useFlag: () => mockUseFlag
          }}
        />
      </TestContainerProvider>
    );
  }
});
