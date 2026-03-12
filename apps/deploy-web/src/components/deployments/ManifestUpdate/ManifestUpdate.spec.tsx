import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DeploymentStorageService } from "@src/services/deployment-storage/deployment-storage.service";
import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import { DEPENDENCIES, ManifestUpdate } from "./ManifestUpdate";

import { act, render, screen, waitFor } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(ManifestUpdate.name, () => {
  it("shows outside deployment message when no local manifest exists", () => {
    setup({
      deploymentLocalStorage: {
        get: vi.fn().mockReturnValue(null)
      }
    });

    expect(screen.getByText(/it looks like this deployment was created using another deploy tool/i)).toBeInTheDocument();
  });

  it("hides outside deployment message and shows editor after clicking Continue", async () => {
    const ButtonMock = vi.fn(ComponentMock);
    setup({
      deploymentLocalStorage: {
        get: vi.fn().mockReturnValue(null)
      },
      dependencies: {
        Button: ButtonMock
      }
    });

    expect(screen.getByText(/it looks like this deployment was created using another deploy tool/i)).toBeInTheDocument();

    const continueButton = ButtonMock.mock.calls.find(call => call[0].children === "Continue");

    await act(() => {
      continueButton?.[0].onClick();
    });

    await waitFor(() => {
      expect(screen.queryByText(/it looks like this deployment was created using another deploy tool/i)).not.toBeInTheDocument();
    });
  });

  it("loads manifest from local storage and calls onManifestChange", async () => {
    const onManifestChange = vi.fn();
    setup({
      onManifestChange,
      deploymentLocalStorage: {
        get: vi.fn().mockReturnValue({ manifest: "version: '2.0'" })
      },
      dependencies: {
        deploymentData: {
          getManifestVersion: vi.fn().mockResolvedValue("abc123")
        }
      }
    });

    await waitFor(() => {
      expect(onManifestChange).toHaveBeenCalledWith("version: '2.0'");
    });
  });

  it("shows parsing error when manifest version retrieval fails", async () => {
    setup({
      deploymentLocalStorage: {
        get: vi.fn().mockReturnValue({ manifest: "version: '2.0'" })
      },
      dependencies: {
        deploymentData: {
          getManifestVersion: vi.fn().mockRejectedValue(new Error("parse error"))
        }
      }
    });

    await waitFor(() => {
      expect(screen.getByText("Error getting manifest version.")).toBeInTheDocument();
    });
  });

  it("disables update button when manifest is empty", () => {
    const ButtonMock = vi.fn(ComponentMock);
    setup({
      editedManifest: "",
      dependencies: {
        Button: ButtonMock
      }
    });

    const updateButton = ButtonMock.mock.calls.find(call => call[0].children === "Update Deployment");
    expect(updateButton?.[0].disabled).toBe(true);
  });

  it("disables update button when deployment is not active", () => {
    const ButtonMock = vi.fn(ComponentMock);
    setup({
      deployment: { dseq: "123", state: "closed", hash: "abc" },
      dependencies: {
        Button: ButtonMock
      }
    });

    const updateButton = ButtonMock.mock.calls.find(call => call[0].children === "Update Deployment");
    expect(updateButton?.[0].disabled).toBe(true);
  });

  it("shows CreateCredentialsButton when credentials are not usable", () => {
    const CreateCredentialsButtonMock = vi.fn(ComponentMock);
    setup({
      providerCredentials: {
        details: { usable: false, isExpired: true, type: "jwt" as const, value: null }
      },
      dependencies: {
        CreateCredentialsButton: CreateCredentialsButtonMock
      }
    });

    expect(CreateCredentialsButtonMock).toHaveBeenCalled();
  });

  it("renders SDLEditor when not remote deploy", () => {
    const SDLEditorMock = vi.fn(ComponentMock);
    setup({
      isRemoteDeploy: false,
      editedManifest: "some-manifest",
      dependencies: {
        SDLEditor: SDLEditorMock
      }
    });

    expect(SDLEditorMock).toHaveBeenCalled();
    expect(SDLEditorMock.mock.calls[0][0].value).toBe("some-manifest");
  });

  it("renders RemoteDeployUpdate when remote deploy", () => {
    const RemoteDeployUpdateMock = vi.fn(ComponentMock);
    setup({
      isRemoteDeploy: true,
      editedManifest: "some-manifest",
      dependencies: {
        RemoteDeployUpdate: RemoteDeployUpdateMock
      }
    });

    expect(RemoteDeployUpdateMock).toHaveBeenCalled();
    expect(RemoteDeployUpdateMock.mock.calls[0][0].sdlString).toBe("some-manifest");
  });

  it("sends update transaction and manifest when hash differs", async () => {
    const ButtonMock = vi.fn(ComponentMock);
    const closeManifestEditor = vi.fn();
    const signAndBroadcastTx = vi.fn().mockResolvedValue(true);
    const { providerProxy, analyticsService } = setup({
      editedManifest: "version: '2.0'",
      deployment: { dseq: "123", state: "active", hash: "different-hash" },
      leases: [{ provider: "provider1" }],
      closeManifestEditor,
      providers: [{ owner: "provider1", hostUri: "https://provider1.com" }],
      wallet: {
        address: "akash1abc",
        signAndBroadcastTx,
        isManaged: false
      },
      dependencies: {
        Button: ButtonMock,
        deploymentData: {
          NewDeploymentData: vi.fn().mockResolvedValue({
            hash: Buffer.from("new-hash"),
            deploymentId: { dseq: "123" }
          }),
          getManifest: vi.fn().mockReturnValue([])
        },
        TransactionMessageData: {
          getUpdateDeploymentMsg: vi.fn().mockReturnValue({ typeUrl: "/update", value: {} })
        }
      }
    });

    const updateButton = ButtonMock.mock.calls.find(call => call[0].children === "Update Deployment");

    await act(async () => {
      await updateButton?.[0].onClick();
    });

    await waitFor(() => {
      expect(signAndBroadcastTx).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(providerProxy.sendManifest).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(analyticsService.track).toHaveBeenCalledWith("update_deployment", {
        category: "deployments",
        label: "Update deployment"
      });
    });
    await waitFor(() => {
      expect(closeManifestEditor).toHaveBeenCalled();
    });
  });

  it("skips transaction when hash matches and only sends manifest", async () => {
    const hashBytes = Buffer.from("matching-hash");
    const base64Hash = hashBytes.toString("base64");
    const ButtonMock = vi.fn(ComponentMock);
    const closeManifestEditor = vi.fn();
    const signAndBroadcastTx = vi.fn();
    const { providerProxy } = setup({
      editedManifest: "version: '2.0'",
      deployment: { dseq: "123", state: "active", hash: base64Hash },
      leases: [{ provider: "provider1" }],
      closeManifestEditor,
      providers: [{ owner: "provider1", hostUri: "https://provider1.com" }],
      wallet: {
        address: "akash1abc",
        signAndBroadcastTx,
        isManaged: false
      },
      dependencies: {
        Button: ButtonMock,
        deploymentData: {
          NewDeploymentData: vi.fn().mockResolvedValue({
            hash: hashBytes,
            deploymentId: { dseq: "123" }
          }),
          getManifest: vi.fn().mockReturnValue([])
        }
      }
    });

    const updateButton = ButtonMock.mock.calls.find(call => call[0].children === "Update Deployment");

    await act(async () => {
      await updateButton?.[0].onClick();
    });

    await waitFor(() => {
      expect(signAndBroadcastTx).not.toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(providerProxy.sendManifest).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(closeManifestEditor).toHaveBeenCalled();
    });
  });

  it("shows YAML parsing error on update failure", async () => {
    const ButtonMock = vi.fn(ComponentMock);
    setup({
      editedManifest: "version: '2.0'",
      dependencies: {
        Button: ButtonMock,
        deploymentData: {
          NewDeploymentData: vi.fn().mockRejectedValue(Object.assign(new Error("bad yaml"), { name: "YAMLException" })),
          getManifest: vi.fn()
        }
      }
    });

    const updateButton = ButtonMock.mock.calls.find(call => call[0].children === "Update Deployment");

    await act(async () => {
      await updateButton?.[0].onClick();
    });

    await waitFor(() => {
      expect(screen.getByText("bad yaml")).toBeInTheDocument();
    });
  });

  it("clears deployment version when text changes in editor", async () => {
    const SDLEditorMock = vi.fn(ComponentMock);
    const onManifestChange = vi.fn();
    setup({
      onManifestChange,
      dependencies: {
        SDLEditor: SDLEditorMock,
        deploymentData: {
          getManifestVersion: vi.fn().mockResolvedValue("version123")
        }
      },
      deploymentLocalStorage: {
        get: vi.fn().mockReturnValue({ manifest: "version: '2.0'" })
      }
    });

    await waitFor(() => {
      expect(onManifestChange).toHaveBeenCalledWith("version: '2.0'");
    });

    act(() => {
      SDLEditorMock.mock.calls[0][0].onChange("updated manifest");
    });

    expect(onManifestChange).toHaveBeenCalledWith("updated manifest");
  });

  function setup(input?: {
    deployment?: Partial<{ dseq: string; state: string; hash: string }>;
    leases?: Array<Partial<{ provider: string }>>;
    editedManifest?: string;
    isRemoteDeploy?: boolean;
    closeManifestEditor?: () => void;
    onManifestChange?: (value: string) => void;
    providers?: Array<Partial<{ owner: string; hostUri: string }>>;
    wallet?: Partial<{ address: string; signAndBroadcastTx: ReturnType<typeof vi.fn>; isManaged: boolean }>;
    providerCredentials?: Partial<{ details: { usable: boolean; isExpired: boolean; type: "jwt" | "mtls"; value: string | null } }>;
    deploymentLocalStorage?: Partial<{ get: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }>;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const providerProxy = mock<ProviderProxyService>();
    const analyticsService = mock<AnalyticsService>();
    const deploymentLocalStorage = {
      get: input?.deploymentLocalStorage?.get || vi.fn().mockReturnValue({ manifest: "version: '2.0'" }),
      set: vi.fn(),
      update: input?.deploymentLocalStorage?.update || vi.fn()
    };

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      ({
        address: input?.wallet?.address || "akash1test",
        signAndBroadcastTx: input?.wallet?.signAndBroadcastTx || vi.fn(),
        isManaged: input?.wallet?.isManaged ?? false,
        walletName: "",
        isWalletConnected: true,
        isWalletLoaded: true,
        connectManagedWallet: vi.fn(),
        logout: vi.fn(),
        isCustodial: false,
        isWalletLoading: false,
        isTrialing: false,
        isOnboarding: false,
        switchWalletType: vi.fn(),
        hasManagedWallet: false
      }) as ReturnType<typeof DEPENDENCIES.useWallet>;

    const useProviderList: typeof DEPENDENCIES.useProviderList = () =>
      ({
        data: input?.providers || [{ owner: "provider1", hostUri: "https://provider1.com" }]
      }) as ReturnType<typeof DEPENDENCIES.useProviderList>;

    const useProviderCredentials: typeof DEPENDENCIES.useProviderCredentials = () => ({
      details: input?.providerCredentials?.details || {
        usable: true,
        isExpired: false,
        type: "jwt" as const,
        value: "test-token"
      },
      generate: vi.fn()
    });

    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => ({
      enqueueSnackbar: vi.fn(),
      closeSnackbar: vi.fn()
    });

    const useSettings: typeof DEPENDENCIES.useSettings = () =>
      ({
        settings: { isBlockchainDown: false }
      }) as ReturnType<typeof DEPENDENCIES.useSettings>;

    render(
      <TestContainerProvider
        services={{
          providerProxy: () => providerProxy,
          analyticsService: () => analyticsService,
          deploymentLocalStorage: () => deploymentLocalStorage as unknown as DeploymentStorageService
        }}
      >
        <ManifestUpdate
          deployment={
            {
              dseq: "123",
              state: "active",
              hash: "abc",
              ...input?.deployment
            } as Parameters<typeof ManifestUpdate>[0]["deployment"]
          }
          leases={(input?.leases || [{ provider: "provider1" }]) as Parameters<typeof ManifestUpdate>[0]["leases"]}
          closeManifestEditor={input?.closeManifestEditor || vi.fn()}
          isRemoteDeploy={input?.isRemoteDeploy ?? false}
          editedManifest={input?.editedManifest ?? "version: '2.0'"}
          onManifestChange={input?.onManifestChange || vi.fn()}
          dependencies={{
            ...MockComponents(DEPENDENCIES),
            useWallet,
            useProviderList,
            useProviderCredentials,
            useSnackbar,
            useSettings,
            deploymentData: {
              getManifestVersion: vi.fn().mockResolvedValue("test-version"),
              getManifest: vi.fn().mockReturnValue([]),
              NewDeploymentData: vi.fn().mockResolvedValue({
                hash: Buffer.from("test-hash"),
                deploymentId: { dseq: "123" }
              })
            } as unknown as typeof DEPENDENCIES.deploymentData,
            TransactionMessageData: {
              getUpdateDeploymentMsg: vi.fn().mockReturnValue({ typeUrl: "/update", value: {} })
            } as unknown as typeof DEPENDENCIES.TransactionMessageData,
            ...input?.dependencies
          }}
        />
      </TestContainerProvider>
    );

    return {
      providerProxy,
      analyticsService,
      deploymentLocalStorage
    };
  }
});
