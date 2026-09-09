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

const PROVIDER_UNAVAILABLE = new ApiError(503, { message: "Provider service is temporarily unavailable" }, "PUT /v1/deployments/{dseq} → 503");
const BAD_SDL = new ApiError(400, { message: "SDL is not valid YAML: line 3, column 5" }, "PUT /v1/deployments/{dseq} → 400");
const BAD_PROVIDER_CREDENTIALS = new ApiError(400, { message: "Invalid provider jwt credentials" }, "PUT /v1/deployments/{dseq} → 400");
const OUT_OF_CREDITS = new ApiError(402, { message: "Insufficient balance: top up to keep deploying" }, "PUT /v1/deployments/{dseq} → 402");
const UNRESOLVED_REFERENCE = new ApiError(
  400,
  { message: 'Invalid SDL: no value supplied for SDL Reference "ac-secret://TOKEN"' },
  "PUT /v1/deployments/{dseq} → 400"
);
const OVERSIZE_SDL = new ApiError(
  400,
  { message: "SDL is too large: it exceeds the maximum of 60000 characters once stored" },
  "PUT /v1/deployments/{dseq} → 400"
);
const SDL_SHAPED_SERVER_FAILURE = new ApiError(500, { message: "Invalid SDL: the console could not read it" }, "PUT /v1/deployments/{dseq} → 500");
const TRIAL_GATED_SDL = new ApiError(
  400,
  { message: "Invalid SDL: rtx4090 not available on free trial: Add funds to unlock GPU access" },
  "PUT /v1/deployments/{dseq} → 400"
);
const UNTITLED_OUT_OF_CREDITS = new ApiError(402, { message: "Not enough funds to cover the transaction fee" }, "PUT /v1/deployments/{dseq} → 402");

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

  it("enables the update button for an active deployment the user can still change", async () => {
    const { dependencies } = setup();

    await waitFor(() => {
      expect(updateButtonOf(dependencies)?.disabled).toBe(false);
    });
  });

  it("treats a cleared editor as an empty manifest", () => {
    const onManifestChange = vi.fn();
    const { dependencies } = setup({ onManifestChange });

    act(() => {
      dependencies.SDLEditor.mock.calls[0][0].onChange?.(undefined, editorChangeEvent());
    });

    expect(onManifestChange).toHaveBeenCalledWith("");
  });

  it("disables update button when manifest is empty", () => {
    const { dependencies } = setup({ editedManifest: "" });

    expect(updateButtonOf(dependencies)?.disabled).toBe(true);
  });

  it("disables update button when deployment is not active", () => {
    const { dependencies } = setup({ deployment: { dseq: "123", state: "closed", hash: "abc" } });

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
    const handles = setup({
      editedManifest: "version: '2.0'",
      deployment: { dseq: "123", state: "active", hash: "different-hash" },
      wallet: { signAndBroadcastTx }
    });

    await clickUpdate(handles);

    expect(handles.mutate).toHaveBeenCalledWith({ dseq: "123", data: { sdl: "version: '2.0'" } }, expect.anything());
    expect(signAndBroadcastTx).not.toHaveBeenCalled();
    expect(handles.providerProxy.sendManifest).not.toHaveBeenCalled();
  });

  it("submits to the console api even when the local manifest version already matches the chain", async () => {
    const handles = setup({
      editedManifest: "version: '2.0'",
      deployment: { dseq: "123", state: "active", hash: "matching-hash" },
      dependencies: {
        deploymentData: mock<typeof DEPENDENCIES.deploymentData>({
          getManifestVersion: vi.fn().mockResolvedValue("matching-hash")
        })
      }
    });

    await clickUpdate(handles);

    expect(handles.mutate).toHaveBeenCalledTimes(1);
  });

  it("caches the submitted sdl under the deployment without a manifest version", async () => {
    const handles = setup({ editedManifest: "version: '2.0'", wallet: { address: "akash1abc" } });

    await clickUpdate(handles);
    await succeed(handles);

    expect(handles.deploymentLocalStorage.update).toHaveBeenCalledWith("akash1abc", "123", { manifest: "version: '2.0'" });
  });

  it("caches the sdl it submitted, not the one edited while the update was in flight", async () => {
    const handles = setup({ editedManifest: "version: '2.0'", wallet: { address: "akash1abc" } });

    await clickUpdate(handles);
    handles.rerenderWith({ editedManifest: "version: '3.0'" });
    await succeed(handles);

    expect(handles.deploymentLocalStorage.update).toHaveBeenCalledWith("akash1abc", "123", { manifest: "version: '2.0'" });
  });

  it("finishes the accepted update even when caching the manifest locally fails", async () => {
    const closeManifestEditor = vi.fn();
    const handles = setup({ closeManifestEditor });
    handles.deploymentLocalStorage.update.mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    await clickUpdate(handles);
    await succeed(handles);

    expect(handles.analyticsService.track).toHaveBeenCalledWith("successful_tx", { category: "transactions", label: "Successful transaction" });
    expect(closeManifestEditor).toHaveBeenCalled();
    expect(handles.enqueueSnackbar).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
  });

  it("caches the submitted sdl even when the editor closes before the api answers", async () => {
    const closeManifestEditor = vi.fn();
    const handles = setup({ editedManifest: "version: '2.0'", wallet: { address: "akash1abc" }, closeManifestEditor });

    await clickUpdate(handles);
    handles.unmount();
    await settleAfterClose(handles, { outcome: "success" });

    expect(handles.deploymentLocalStorage.update).toHaveBeenCalledWith("akash1abc", "123", { manifest: "version: '2.0'" });
    expect(closeManifestEditor).not.toHaveBeenCalled();
  });

  it("surfaces the failure even when the editor closes before the api answers", async () => {
    const handles = setup();

    await clickUpdate(handles);
    handles.unmount();
    await settleAfterClose(handles, { outcome: "failure", cause: PROVIDER_UNAVAILABLE });

    expect(handles.enqueueSnackbar).toHaveBeenCalled();
  });

  it("falls back to a snackbar when an sdl refusal arrives after the editor closes", async () => {
    const handles = setup();

    await clickUpdate(handles);
    handles.unmount();
    await settleAfterClose(handles, { outcome: "failure", cause: BAD_SDL });

    expect(handles.enqueueSnackbar).toHaveBeenCalled();
  });

  it("tracks the update and the successful transaction once the api accepts it", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await succeed(handles);

    expect(handles.analyticsService.track).toHaveBeenCalledWith("update_deployment", { category: "deployments", label: "Update deployment" });
    expect(handles.analyticsService.track).toHaveBeenCalledWith("successful_tx", { category: "transactions", label: "Successful transaction" });
  });

  it("refreshes the balances once the api accepts the update", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await succeed(handles);

    expect(handles.refetchBalances).toHaveBeenCalled();
  });

  it("refreshes the balances when the api refuses the update for payment", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, OUT_OF_CREDITS);

    expect(handles.refetchBalances).toHaveBeenCalled();
  });

  it("closes the editor once the api accepts the update", async () => {
    const closeManifestEditor = vi.fn();
    const handles = setup({ closeManifestEditor });

    await clickUpdate(handles);
    await succeed(handles);

    expect(closeManifestEditor).toHaveBeenCalled();
    expect(updateButtonOf(handles.dependencies)?.disabled).toBe(false);
  });

  it("shows the sdl the api refused inline and leaves the editor open", async () => {
    const closeManifestEditor = vi.fn();
    const handles = setup({ closeManifestEditor });

    await clickUpdate(handles);
    await fail(handles, BAD_SDL);

    expect(screen.getByText("SDL is not valid YAML: line 3, column 5")).toBeInTheDocument();
    expect(closeManifestEditor).not.toHaveBeenCalled();
    expect(handles.deploymentLocalStorage.update).not.toHaveBeenCalled();
    expect(handles.enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("lets the user retry after editing the sdl the api refused", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, BAD_SDL);

    expect(updateButtonOf(handles.dependencies)?.disabled).toBe(true);

    await act(async () => {
      handles.dependencies.SDLEditor.mock.calls[0][0].onChange?.("version: '2.0'\nfixed: true", editorChangeEvent());
    });

    expect(screen.queryByText("SDL is not valid YAML: line 3, column 5")).not.toBeInTheDocument();
    expect(updateButtonOf(handles.dependencies)?.disabled).toBe(false);
  });

  it("lets the user retry after editing in the remote deploy editor", async () => {
    const handles = setup({ isRemoteDeploy: true });

    await clickUpdate(handles);
    await fail(handles, BAD_SDL);

    expect(screen.getByText("SDL is not valid YAML: line 3, column 5")).toBeInTheDocument();

    await act(async () => {
      handles.dependencies.RemoteDeployUpdate.mock.calls[0][0].onManifestChange("version: '2.0'\nfixed: true");
    });

    expect(screen.queryByText("SDL is not valid YAML: line 3, column 5")).not.toBeInTheDocument();
    expect(updateButtonOf(handles.dependencies)?.disabled).toBe(false);
  });

  it("shows a refused sdl reference inline", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, UNRESOLVED_REFERENCE);

    expect(screen.getByText('Invalid SDL: no value supplied for SDL Reference "ac-secret://TOKEN"')).toBeInTheDocument();
    expect(handles.enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("shows an oversize sdl inline", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, OVERSIZE_SDL);

    expect(screen.getByText("SDL is too large: it exceeds the maximum of 60000 characters once stored")).toBeInTheDocument();
    expect(handles.enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("keeps a server failure out of the inline alert even when it reads like an sdl refusal", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, SDL_SHAPED_SERVER_FAILURE);

    expect(screen.queryByText("Invalid SDL: the console could not read it")).not.toBeInTheDocument();
    expect(handles.enqueueSnackbar).toHaveBeenCalled();
  });

  it("keeps a refused provider credential out of the editor's inline alert", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, BAD_PROVIDER_CREDENTIALS);

    expect(screen.queryByText("Invalid provider jwt credentials")).not.toBeInTheDocument();
    expect(handles.enqueueSnackbar).toHaveBeenCalled();
    expect(updateButtonOf(handles.dependencies)?.disabled).toBe(false);
  });

  it("surfaces the provider failure the api reports in a snackbar that does not auto hide", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, PROVIDER_UNAVAILABLE);

    const [element, options] = handles.enqueueSnackbar.mock.calls[0];
    expect(element.type).toBe(handles.dependencies.Snackbar);
    expect(element.props.subTitle).toBe("Provider service is temporarily unavailable");
    expect(options).toEqual({ variant: "error", autoHideDuration: null });
  });

  it("re-enables the update and redeploy actions after a failed update", async () => {
    const onRedeploy = vi.fn();
    const handles = setup({ onRedeploy });

    await clickUpdate(handles);
    await fail(handles, PROVIDER_UNAVAILABLE);

    expect(updateButtonOf(handles.dependencies)?.disabled).toBe(false);
    expect(redeployButtonOf(handles.dependencies, onRedeploy)?.disabled).toBe(false);
  });

  it("offers the add credits action when the api refuses the update for payment", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, OUT_OF_CREDITS);

    const [element, options] = handles.enqueueSnackbar.mock.calls[0];
    expect(element.props.title).toBe("Insufficient balance");
    expect(element.props.subTitle.type).toBe(handles.dependencies.AddCreditsSnackbarContent);
    expect(element.props.subTitle.props.message).toBe("top up to keep deploying");
    expect(options).toEqual({ variant: "warning", autoHideDuration: 10000 });
  });

  it("offers the add credits action when the trial refuses the gpu the sdl requests", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, TRIAL_GATED_SDL);

    const [element, options] = handles.enqueueSnackbar.mock.calls[0];
    expect(element.props.title).toBe("rtx4090 not available on free trial");
    expect(element.props.subTitle.type).toBe(handles.dependencies.AddCreditsSnackbarContent);
    expect(element.props.subTitle.props.message).toBe("Add funds to unlock GPU access");
    expect(options).toEqual({ variant: "warning", autoHideDuration: 10000 });
  });

  it("keeps the trial gating refusal out of the editor's inline alert", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, TRIAL_GATED_SDL);

    expect(screen.queryByText(/not available on free trial/)).not.toBeInTheDocument();
    expect(updateButtonOf(handles.dependencies)?.disabled).toBe(false);
  });

  it("shows the whole refusal in the add credits snackbar body when it carries no title of its own", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, UNTITLED_OUT_OF_CREDITS);

    const [element] = handles.enqueueSnackbar.mock.calls[0];
    expect(element.props.title).toBe("Add credits to continue");
    expect(element.props.subTitle.props.message).toBe("Not enough funds to cover the transaction fee");
  });

  it("dismisses the add credits snackbar once the user acts on it", async () => {
    const handles = setup();
    handles.enqueueSnackbar.mockReturnValue("snackbar-key");

    await clickUpdate(handles);
    await fail(handles, OUT_OF_CREDITS);

    handles.enqueueSnackbar.mock.calls[0][0].props.subTitle.props.onAction();

    expect(handles.closeSnackbar).toHaveBeenCalledWith("snackbar-key");
  });

  it("names the add credits snackbar itself when the api sends no message with the refusal", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, new ApiError(402, {}, "PUT /v1/deployments/{dseq} → 402"));

    expect(handles.enqueueSnackbar.mock.calls[0][0].props.title).toBe("Add credits to continue");
  });

  it("re-enables the update action after the api refuses the update for payment", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, OUT_OF_CREDITS);

    expect(updateButtonOf(handles.dependencies)?.disabled).toBe(false);
  });

  it("tracks a failed transaction when the api refuses the update", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, PROVIDER_UNAVAILABLE);

    expect(handles.analyticsService.track).toHaveBeenCalledWith("failed_tx", { category: "transactions", label: "Failed transaction" });
  });

  it("tracks no failed transaction when the api refuses the sdl before attempting one", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, BAD_SDL);

    expect(handles.analyticsService.track).not.toHaveBeenCalledWith("failed_tx", expect.anything());
  });

  it("tracks no failed transaction when the api refuses the update for payment", async () => {
    const handles = setup();

    await clickUpdate(handles);
    await fail(handles, OUT_OF_CREDITS);

    expect(handles.analyticsService.track).not.toHaveBeenCalledWith("failed_tx", expect.anything());
  });

  it("clears deployment version when text changes in editor", async () => {
    const onManifestChange = vi.fn();
    const { dependencies } = setup({ onManifestChange, storedManifest: "version: '2.0'" });

    await waitFor(() => {
      expect(onManifestChange).toHaveBeenCalledWith("version: '2.0'");
    });

    act(() => {
      dependencies.SDLEditor.mock.calls[0][0].onChange?.("updated manifest", editorChangeEvent());
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
    const handles = setup({ onRedeploy });

    await clickUpdate(handles);

    await waitFor(() => {
      expect(redeployButtonOf(handles.dependencies, onRedeploy)?.disabled).toBe(true);
    });
  });

  it("omits the redeploy action when the host page provides no handler", () => {
    const { dependencies } = setup();

    expect(dependencies.Button.mock.calls.map(call => call[0].children)).toEqual(["Update Deployment"]);
  });

  type Handles = ReturnType<typeof setup>;
  type Dependencies = Handles["dependencies"];

  function editorChangeEvent() {
    return mock<Parameters<NonNullable<Parameters<typeof DEPENDENCIES.SDLEditor>[0]["onChange"]>>[1]>();
  }

  function updateButtonOf(dependencies: Dependencies) {
    return dependencies.Button.mock.calls.filter(call => call[0].children === "Update Deployment").at(-1)?.[0];
  }

  function redeployButtonOf(dependencies: Dependencies, onRedeploy: () => void) {
    return dependencies.Button.mock.calls.filter(call => call[0].onClick === onRedeploy).at(-1)?.[0];
  }

  async function clickUpdate(handles: Handles) {
    const updateButton = updateButtonOf(handles.dependencies);

    await act(async () => {
      updateButton?.onClick?.(mock<MouseEvent<HTMLButtonElement>>());
    });
  }

  function submittedVariablesOf(handles: Handles) {
    return handles.mutate.mock.calls[0][0];
  }

  async function succeed(handles: Handles) {
    await act(async () => {
      handles.mutationOptions.current?.onSuccess?.({ data: {} }, submittedVariablesOf(handles));
      handles.mutate.mock.calls[0][1]?.onSuccess?.({ data: {} });
    });
  }

  async function fail(handles: Handles, cause: unknown) {
    await act(async () => {
      handles.mutationOptions.current?.onError?.(cause);
      handles.mutate.mock.calls[0][1]?.onError?.(cause);
    });
  }

  async function settleAfterClose(handles: Handles, outcome: { outcome: "success" } | { outcome: "failure"; cause: unknown }) {
    await act(async () => {
      if (outcome.outcome === "success") {
        handles.mutationOptions.current?.onSuccess?.({ data: {} }, submittedVariablesOf(handles));
        return;
      }
      handles.mutationOptions.current?.onError?.(outcome.cause);
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
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const providerProxy = mock<ProviderProxyService>();
    const analyticsService = mock<AnalyticsService>();
    const deploymentLocalStorage = mock<DeploymentStorageService>();
    deploymentLocalStorage.get.mockReturnValue(input?.storedManifest === null ? null : { manifest: input?.storedManifest ?? "version: '2.0'" });

    const mutate = vi.fn();
    const mutationOptions: {
      current?: { onSuccess?: (data: unknown, variables: { dseq: string; data: { sdl: string } }) => void; onError?: (cause: unknown) => void };
    } = {};
    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.updateDeployment.useMutation.mockImplementation(options => {
      mutationOptions.current = options as typeof mutationOptions.current;
      return mock<ReturnType<typeof api.v1.updateDeployment.useMutation>>({ mutate });
    });

    const enqueueSnackbar = vi.fn();
    const closeSnackbar = vi.fn();
    const balances = mock<ReturnType<typeof DEPENDENCIES.useBalances>>();

    const useWallet: typeof DEPENDENCIES.useWallet = () =>
      buildWallet({
        address: input?.wallet?.address || "akash1test",
        signAndBroadcastTx: input?.wallet?.signAndBroadcastTx || vi.fn(() => Promise.resolve(true))
      });

    const useBalances: typeof DEPENDENCIES.useBalances = () => balances;

    const useSnackbar: typeof DEPENDENCIES.useSnackbar = () => ({ enqueueSnackbar, closeSnackbar });

    const useBlockchainStatus: typeof DEPENDENCIES.useBlockchainStatus = () =>
      mock<ReturnType<typeof DEPENDENCIES.useBlockchainStatus>>({ isBlockchainDown: false });

    const dependencies = MockComponents(DEPENDENCIES, {
      DeploymentTabHeader: vi.fn(({ actions, children }) => (
        <>
          {children}
          {actions}
        </>
      )),
      useWallet,
      useBalances,
      useSnackbar,
      useBlockchainStatus,
      deploymentData: mock<typeof DEPENDENCIES.deploymentData>({
        getManifestVersion: vi.fn().mockResolvedValue("test-version")
      }),
      ...input?.dependencies
    });

    const closeManifestEditor = input?.closeManifestEditor || vi.fn();
    const onManifestChange = input?.onManifestChange || vi.fn();

    const componentWith = (overrides?: { editedManifest: string }) => (
      <TestContainerProvider
        services={{
          api: () => api,
          providerProxy: () => providerProxy,
          analyticsService: () => analyticsService,
          deploymentLocalStorage: () => deploymentLocalStorage
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
          closeManifestEditor={closeManifestEditor}
          isRemoteDeploy={input?.isRemoteDeploy ?? false}
          editedManifest={overrides?.editedManifest ?? input?.editedManifest ?? "version: '2.0'"}
          onManifestChange={onManifestChange}
          onRedeploy={input?.onRedeploy}
          dependencies={dependencies}
        />
      </TestContainerProvider>
    );

    const { unmount, rerender } = render(componentWith());

    return {
      rerenderWith: (overrides: { editedManifest: string }) => rerender(componentWith(overrides)),
      providerProxy,
      analyticsService,
      deploymentLocalStorage,
      dependencies,
      mutate,
      mutationOptions,
      enqueueSnackbar,
      closeSnackbar,
      refetchBalances: balances.refetch,
      unmount
    };
  }
});
