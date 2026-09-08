import type { MouseEvent } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { ContextType } from "@src/context/WalletProvider";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { DeploymentStorageService } from "@src/services/deployment-storage/deployment-storage.service";
import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import { DEPENDENCIES, ManifestUpdate } from "./ManifestUpdate";

import { act, render, screen, waitFor } from "@testing-library/react";
import { buildWallet } from "@tests/seeders/wallet";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(ManifestUpdate.name, () => {
  it("shows outside deployment message when no local manifest exists", () => {
    setup({ storedManifest: null });

    expect(screen.getByText(/it looks like this deployment was created using another deploy tool/i)).toBeInTheDocument();
  });

  it("hides outside deployment message and shows editor after clicking Continue", async () => {
    const { dependencies } = setup({ storedManifest: null });

    expect(screen.getByText(/it looks like this deployment was created using another deploy tool/i)).toBeInTheDocument();

    const continueButton = dependencies.Button.mock.calls.find(call => call[0].children === "Continue");

    await act(() => {
      continueButton?.[0].onClick?.(mock<MouseEvent<HTMLButtonElement>>());
    });

    await waitFor(() => {
      expect(screen.queryByText(/it looks like this deployment was created using another deploy tool/i)).not.toBeInTheDocument();
    });
  });

  it("loads manifest from local storage and calls onManifestChange", async () => {
    const onManifestChange = vi.fn();
    setup({ onManifestChange, storedManifest: "version: '2.0'" });

    await waitFor(() => {
      expect(onManifestChange).toHaveBeenCalledWith("version: '2.0'");
    });
  });

  it("shows parsing error when manifest version retrieval fails", async () => {
    setup({
      storedManifest: "version: '2.0'",
      dependencies: {
        deploymentData: mock<typeof DEPENDENCIES.deploymentData>({
          getManifestVersion: vi.fn().mockRejectedValue(new Error("parse error"))
        })
      }
    });

    await waitFor(() => {
      expect(screen.getByText("Error getting manifest version.")).toBeInTheDocument();
    });
  });

  it("disables update button when manifest is empty", () => {
    const { dependencies } = setup({ editedManifest: "" });

    expect(updateButtonOf(dependencies)?.disabled).toBe(true);
  });

  it("disables update button when deployment is not active", () => {
    const { dependencies } = setup({ deployment: { dseq: "123", state: "closed", hash: "abc" } });

    expect(updateButtonOf(dependencies)?.disabled).toBe(true);
  });

  it("disables update button when credentials are not usable", () => {
    const { dependencies } = setup({
      providerCredentials: {
        details: { usable: false, isExpired: true, type: "jwt" as const, value: null, error: null }
      }
    });

    expect(updateButtonOf(dependencies)?.disabled).toBe(true);
  });

  it("renders SDLEditor when not remote deploy", () => {
    const { dependencies } = setup({ isRemoteDeploy: false, editedManifest: "some-manifest" });

    expect(dependencies.SDLEditor).toHaveBeenCalled();
    expect(dependencies.SDLEditor.mock.calls[0][0].value).toBe("some-manifest");
  });

  it("renders RemoteDeployUpdate when remote deploy", () => {
    const { dependencies } = setup({ isRemoteDeploy: true, editedManifest: "some-manifest" });

    expect(dependencies.RemoteDeployUpdate).toHaveBeenCalled();
    expect(dependencies.RemoteDeployUpdate.mock.calls[0][0].sdlString).toBe("some-manifest");
  });

  it("submits the edited sdl to the console api instead of signing and sending it from the browser", async () => {
    const signAndBroadcastTx = vi.fn(() => Promise.resolve(true));
    const { mutate, providerProxy, dependencies } = setup({
      editedManifest: "version: '2.0'",
      deployment: { dseq: "123", state: "active", hash: "different-hash" },
      wallet: { signAndBroadcastTx }
    });

    await clickUpdate(dependencies);

    expect(mutate).toHaveBeenCalledWith({ dseq: "123", data: { sdl: "version: '2.0'" } }, expect.anything());
    expect(signAndBroadcastTx).not.toHaveBeenCalled();
    expect(providerProxy.sendManifest).not.toHaveBeenCalled();
  });

  it("submits to the console api even when the local manifest version already matches the chain", async () => {
    const { mutate, dependencies } = setup({
      editedManifest: "version: '2.0'",
      deployment: { dseq: "123", state: "active", hash: "matching-hash" },
      dependencies: {
        deploymentData: mock<typeof DEPENDENCIES.deploymentData>({
          getManifestVersion: vi.fn().mockResolvedValue("matching-hash")
        })
      }
    });

    await clickUpdate(dependencies);

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("caches the submitted sdl under the deployment without a manifest version", async () => {
    const { mutate, deploymentLocalStorage, dependencies } = setup({ editedManifest: "version: '2.0'", wallet: { address: "akash1abc" } });

    await clickUpdate(dependencies);
    await succeed(mutate);

    expect(deploymentLocalStorage.update).toHaveBeenCalledWith("akash1abc", "123", { manifest: "version: '2.0'" });
  });

  it("tracks the update and the successful transaction once the api accepts it", async () => {
    const { mutate, analyticsService, dependencies } = setup();

    await clickUpdate(dependencies);
    await succeed(mutate);

    expect(analyticsService.track).toHaveBeenCalledWith("update_deployment", { category: "deployments", label: "Update deployment" });
    expect(analyticsService.track).toHaveBeenCalledWith("successful_tx", { category: "transactions", label: "Successful transaction" });
  });

  it("refreshes the balances once the api accepts the update", async () => {
    const { mutate, refetchBalances, dependencies } = setup();

    await clickUpdate(dependencies);
    await succeed(mutate);

    expect(refetchBalances).toHaveBeenCalled();
  });

  it("closes the editor once the api accepts the update", async () => {
    const closeManifestEditor = vi.fn();
    const { mutate, dependencies } = setup({ closeManifestEditor });

    await clickUpdate(dependencies);
    await succeed(mutate);

    expect(closeManifestEditor).toHaveBeenCalled();
  });

  it("shows the sdl the api refused inline and leaves the editor open", async () => {
    const closeManifestEditor = vi.fn();
    const { mutate, deploymentLocalStorage, dependencies } = setup({ closeManifestEditor });

    await clickUpdate(dependencies);
    await fail(mutate, new ApiError(400, { message: "SDL is not valid YAML: line 3, column 5" }, "PUT /v1/deployments/{dseq} → 400"));

    expect(screen.getByText("SDL is not valid YAML: line 3, column 5")).toBeInTheDocument();
    expect(closeManifestEditor).not.toHaveBeenCalled();
    expect(deploymentLocalStorage.update).not.toHaveBeenCalled();
  });

  it("surfaces the provider failure the api reports in a snackbar that does not auto hide", async () => {
    const { mutate, enqueueSnackbar, dependencies } = setup();

    await clickUpdate(dependencies);
    await fail(mutate, new ApiError(503, { message: "Provider service is temporarily unavailable" }, "PUT /v1/deployments/{dseq} → 503"));

    const [element, options] = enqueueSnackbar.mock.calls[0];
    expect(element.type).toBe(dependencies.Snackbar);
    expect(element.props.subTitle).toBe("Provider service is temporarily unavailable");
    expect(options).toEqual({ variant: "error", autoHideDuration: null });
  });

  it("offers the add credits action when the api refuses the update for payment", async () => {
    const { mutate, enqueueSnackbar, dependencies } = setup();

    await clickUpdate(dependencies);
    await fail(mutate, new ApiError(402, { message: "Insufficient balance: top up to keep deploying" }, "PUT /v1/deployments/{dseq} → 402"));

    const [element, options] = enqueueSnackbar.mock.calls[0];
    expect(element.props.title).toBe("Insufficient balance");
    expect(element.props.subTitle.type).toBe(dependencies.AddCreditsSnackbarContent);
    expect(element.props.subTitle.props.message).toBe("top up to keep deploying");
    expect(options).toEqual({ variant: "warning", autoHideDuration: 10000 });
  });

  it("tracks a failed transaction when the api refuses the update", async () => {
    const { mutate, analyticsService, dependencies } = setup();

    await clickUpdate(dependencies);
    await fail(mutate, new ApiError(503, { message: "Provider service is temporarily unavailable" }, "PUT /v1/deployments/{dseq} → 503"));

    expect(analyticsService.track).toHaveBeenCalledWith("failed_tx", { category: "transactions", label: "Failed transaction" });
  });

  it("clears deployment version when text changes in editor", async () => {
    const onManifestChange = vi.fn();
    const { dependencies } = setup({ onManifestChange, storedManifest: "version: '2.0'" });

    await waitFor(() => {
      expect(onManifestChange).toHaveBeenCalledWith("version: '2.0'");
    });

    act(() => {
      dependencies.SDLEditor.mock.calls[0][0].onChange?.(
        "updated manifest",
        mock<Parameters<NonNullable<Parameters<typeof DEPENDENCIES.SDLEditor>[0]["onChange"]>>[1]>()
      );
    });

    expect(onManifestChange).toHaveBeenCalledWith("updated manifest");
  });

  it("renders the redeploy action wired to the handler the update tab supplies", () => {
    const onRedeploy = vi.fn();
    const { dependencies } = setup({ onRedeploy });

    expect(dependencies.Button.mock.calls.some(call => call[0].onClick === onRedeploy)).toBe(true);
  });

  it("disables the redeploy action while an update is in flight", async () => {
    const onRedeploy = vi.fn();
    const { dependencies } = setup({ onRedeploy });

    await clickUpdate(dependencies);

    await waitFor(() => {
      const redeployRenders = dependencies.Button.mock.calls.filter(call => call[0].onClick === onRedeploy);
      expect(redeployRenders[redeployRenders.length - 1][0].disabled).toBe(true);
    });
  });

  it("omits the redeploy action when the host page provides no handler", () => {
    const { dependencies } = setup();

    expect(dependencies.Button.mock.calls.map(call => call[0].children)).toEqual(["Update Deployment"]);
  });

  it("wires no transaction message builder, so nothing can sign an update from the browser", () => {
    expect(Object.keys(DEPENDENCIES)).not.toContain("TransactionMessageData");
  });

  type Dependencies = ReturnType<typeof setup>["dependencies"];

  function updateButtonOf(dependencies: Dependencies) {
    return dependencies.Button.mock.calls.find(call => call[0].children === "Update Deployment")?.[0];
  }

  async function clickUpdate(dependencies: Dependencies) {
    const updateButton = updateButtonOf(dependencies);

    await act(async () => {
      updateButton?.onClick?.(mock<MouseEvent<HTMLButtonElement>>());
    });
  }

  async function succeed(mutate: ReturnType<typeof vi.fn>) {
    await act(async () => {
      mutate.mock.calls[0][1].onSuccess({ data: {} });
    });
  }

  async function fail(mutate: ReturnType<typeof vi.fn>, cause: unknown) {
    await act(async () => {
      mutate.mock.calls[0][1].onError(cause);
    });
  }

  function setup(input?: {
    deployment?: Partial<{ dseq: string; state: string; hash: string }>;
    editedManifest?: string;
    isRemoteDeploy?: boolean;
    storedManifest?: string | null;
    closeManifestEditor?: () => void;
    onManifestChange?: (value: string) => void;
    onRedeploy?: () => void;
    wallet?: Partial<{ address: string; signAndBroadcastTx: ContextType["signAndBroadcastTx"] }>;
    providerCredentials?: Partial<{ details: { usable: boolean; isExpired: boolean; type: "jwt"; value: string | null; error: Error | null } }>;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const providerProxy = mock<ProviderProxyService>();
    const analyticsService = mock<AnalyticsService>();
    const deploymentLocalStorage = {
      get: vi
        .fn<DeploymentStorageService["get"]>()
        .mockReturnValue(input?.storedManifest === null ? null : { manifest: input?.storedManifest ?? "version: '2.0'" }),
      set: vi.fn<DeploymentStorageService["set"]>(),
      update: vi.fn<DeploymentStorageService["update"]>()
    };

    const mutate = vi.fn();
    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.updateDeployment.useMutation.mockReturnValue(mock<ReturnType<typeof api.v1.updateDeployment.useMutation>>({ mutate }));

    const enqueueSnackbar = vi.fn();
    const balances = mock<ReturnType<typeof DEPENDENCIES.useBalances>>();

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      buildWallet({
        address: input?.wallet?.address || "akash1test",
        signAndBroadcastTx: input?.wallet?.signAndBroadcastTx || vi.fn(() => Promise.resolve(true))
      });

    const useBalances: typeof DEPENDENCIES.useBalances = () => balances;

    const useProviderCredentials: typeof DEPENDENCIES.useProviderCredentials = () => ({
      details: input?.providerCredentials?.details || {
        usable: true,
        isExpired: false,
        type: "jwt" as const,
        value: "test-token",
        error: null
      },
      ensureToken: vi.fn().mockResolvedValue("test-token")
    });

    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => ({ enqueueSnackbar, closeSnackbar: vi.fn() });

    const useBlockchainStatus: typeof DEPENDENCIES.useBlockchainStatus = () =>
      mock<ReturnType<typeof DEPENDENCIES.useBlockchainStatus>>({ isBlockchainDown: false });

    const dependencies = MockComponents(DEPENDENCIES, {
      useWallet,
      useBalances,
      useProviderCredentials,
      useSnackbar,
      useBlockchainStatus,
      deploymentData: mock<typeof DEPENDENCIES.deploymentData>({
        getManifestVersion: vi.fn().mockResolvedValue("test-version")
      }),
      ...input?.dependencies
    });

    render(
      <TestContainerProvider
        services={{
          api: () => api,
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
          closeManifestEditor={input?.closeManifestEditor || vi.fn()}
          isRemoteDeploy={input?.isRemoteDeploy ?? false}
          editedManifest={input?.editedManifest ?? "version: '2.0'"}
          onManifestChange={input?.onManifestChange || vi.fn()}
          onRedeploy={input?.onRedeploy}
          dependencies={dependencies}
        />
      </TestContainerProvider>
    );

    return { providerProxy, analyticsService, deploymentLocalStorage, dependencies, mutate, enqueueSnackbar, refetchBalances: balances.refetch };
  }
});
