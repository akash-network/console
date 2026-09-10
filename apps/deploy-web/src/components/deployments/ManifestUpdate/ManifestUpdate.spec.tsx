import type { MouseEvent } from "react";
import type { LoggerService } from "@akashnetwork/logging";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { ContextType } from "@src/context/WalletProvider";
import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
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

const WITHHELD_VALUES_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN=ac-secret://s0_e0"\n';
const BLANK_ENV_VALUES_SDL = 'version: "2.0"\nservices:\n  web:\n    image: nginx\n    env:\n      - "TOKEN="\n';

describe(ManifestUpdate.name, () => {
  it("shows outside deployment message when neither source holds a definition", () => {
    setup({ definition: { sdl: undefined, source: "absent" } });

    expect(screen.getByText(/it looks like this deployment was created using another deploy tool/i)).toBeInTheDocument();
  });

  it("hides outside deployment message and shows editor after clicking Continue", async () => {
    const { dependencies } = setup({ definition: { sdl: undefined, source: "absent" } });

    expect(screen.getByText(/it looks like this deployment was created using another deploy tool/i)).toBeInTheDocument();

    await continuePastTheNotice(dependencies);

    await waitFor(() => {
      expect(screen.queryByText(/it looks like this deployment was created using another deploy tool/i)).not.toBeInTheDocument();
    });
  });

  it("seeds the editor from the resolved definition", async () => {
    const onManifestChange = vi.fn();
    setup({ onManifestChange, definition: { sdl: "version: '2.0'", source: "local" } });

    await waitFor(() => {
      expect(onManifestChange).toHaveBeenCalledWith("version: '2.0'");
    });
  });

  it("shows parsing error and logs the cause when manifest version retrieval fails", async () => {
    const { logger } = setup({
      definition: { sdl: "version: '2.0'", source: "local" },
      dependencies: {
        deploymentData: mock<typeof DEPENDENCIES.deploymentData>({
          getManifestVersion: vi.fn().mockRejectedValue(new Error("parse error"))
        })
      }
    });

    await waitFor(() => {
      expect(screen.getByText("Error getting manifest version.")).toBeInTheDocument();
    });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "MANIFEST_VERSION_READ_FAILED" }));
  });

  it("seeds the editor from the api definition, never from this browser's copy", async () => {
    const onManifestChange = vi.fn();
    setup({
      onManifestChange,
      definition: { sdl: "version: '2.0' # from-the-api", source: "api" },
      storedManifest: "version: '2.0' # from-this-browser"
    });

    await waitFor(() => expect(onManifestChange).toHaveBeenCalledWith("version: '2.0' # from-the-api"));
    expect(onManifestChange.mock.calls.flat()).not.toContain("version: '2.0' # from-this-browser");
  });

  it("shows neither the editor nor a notice while the definition is still resolving", () => {
    const onManifestChange = vi.fn();
    const { dependencies } = setup({ definition: { sdl: undefined, source: "resolving" }, onManifestChange });

    expect(screen.queryByText(/it looks like this deployment was created using another deploy tool/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/secret values withheld/i)).not.toBeInTheDocument();
    expect(dependencies.SDLEditor).not.toHaveBeenCalled();
    expect(onManifestChange).not.toHaveBeenCalled();
  });

  it("keeps the user's unsaved edits when a refetch changes the resolved definition", async () => {
    const onManifestChange = vi.fn();
    const { rerenderDefinition } = setup({ definition: { sdl: "version: '2.0'", source: "local" }, onManifestChange });

    await waitFor(() => expect(onManifestChange).toHaveBeenCalledWith("version: '2.0'"));

    rerenderDefinition({ sdl: "version: '3.0' # refetched", name: undefined, source: "api" }, { editedManifest: "version: '2.0' # user edit" });

    expect(onManifestChange).not.toHaveBeenCalledWith("version: '3.0' # refetched");
  });

  it("reseeds an untouched editor when a refetch changes the resolved definition", async () => {
    const onManifestChange = vi.fn();
    const { rerenderDefinition } = setup({ definition: { sdl: "version: '2.0'", source: "local" }, onManifestChange });

    await waitFor(() => expect(onManifestChange).toHaveBeenCalledWith("version: '2.0'"));

    rerenderDefinition({ sdl: "version: '3.0' # refetched", name: undefined, source: "api" }, { editedManifest: "version: '2.0'" });

    await waitFor(() => expect(onManifestChange).toHaveBeenCalledWith("version: '3.0' # refetched"));
  });

  it("keeps what the user typed into an editor that resolved with no definition at all", () => {
    const onManifestChange = vi.fn();
    const { rerenderDefinition } = setup({ definition: { sdl: undefined, source: "absent" }, editedManifest: "", onManifestChange });

    rerenderDefinition({ sdl: "version: '2.0' # recorded later", name: undefined, source: "absent" }, { editedManifest: "version: '2.0' # typed by hand" });

    expect(onManifestChange).not.toHaveBeenCalledWith("version: '2.0' # recorded later");
  });

  it("seeds an untouched editor once a definition the api had yet to record arrives", async () => {
    const onManifestChange = vi.fn();
    const { rerenderDefinition } = setup({ definition: { sdl: undefined, source: "absent" }, editedManifest: "", onManifestChange });

    rerenderDefinition({ sdl: "version: '2.0' # recorded later", name: undefined, source: "absent" }, { editedManifest: "" });

    await waitFor(() => expect(onManifestChange).toHaveBeenCalledWith("version: '2.0' # recorded later"));
  });

  describe("the local-versus-chain warning", () => {
    it("renders for a definition served from this browser whose version differs from the chain", async () => {
      const { dependencies } = setup({
        definition: { sdl: "version: '2.0'", source: "local" },
        deployment: { dseq: "123", state: "active", hash: "on-chain-hash" },
        dependencies: { deploymentData: mock<typeof DEPENDENCIES.deploymentData>({ getManifestVersion: vi.fn().mockResolvedValue("a-different-hash") }) }
      });

      await waitFor(() => expect(dependencies.WarningCircle).toHaveBeenCalled());
    });

    it("renders for an api copy the chain has moved past once its notice is dismissed", async () => {
      const { dependencies } = setup({
        definition: { sdl: "version: '2.0' # recorded-v1", source: "absent" },
        deployment: { dseq: "123", state: "active", hash: "on-chain-hash" },
        dependencies: { deploymentData: mock<typeof DEPENDENCIES.deploymentData>({ getManifestVersion: vi.fn().mockResolvedValue("recorded-v1-hash") }) }
      });

      await continuePastTheNotice(dependencies);

      await waitFor(() => expect(dependencies.WarningCircle).toHaveBeenCalled());
    });

    it("seeds the editor with the api copy the chain has moved past so the user can see what the console recorded", async () => {
      const onManifestChange = vi.fn();
      setup({ definition: { sdl: "version: '2.0' # recorded-v1", source: "absent" }, onManifestChange });

      await waitFor(() => expect(onManifestChange).toHaveBeenCalledWith("version: '2.0' # recorded-v1"));
    });

    it("does not render for a definition served by the api", async () => {
      const { dependencies } = setup({
        definition: { sdl: "version: '2.0'", source: "api" },
        deployment: { dseq: "123", state: "active", hash: "on-chain-hash" },
        dependencies: { deploymentData: mock<typeof DEPENDENCIES.deploymentData>({ getManifestVersion: vi.fn().mockResolvedValue("a-different-hash") }) }
      });

      await waitFor(() => expect(dependencies.SDLEditor).toHaveBeenCalled());
      expect(dependencies.WarningCircle).not.toHaveBeenCalled();
    });

    it("stops rendering when a refetch moves the definition from this browser to the api", async () => {
      const { dependencies, rerenderDefinition } = setup({
        definition: { sdl: "version: '2.0'", source: "local" },
        deployment: { dseq: "123", state: "active", hash: "on-chain-hash" },
        dependencies: { deploymentData: mock<typeof DEPENDENCIES.deploymentData>({ getManifestVersion: vi.fn().mockResolvedValue("a-different-hash") }) }
      });

      await waitFor(() => expect(dependencies.WarningCircle).toHaveBeenCalled());

      rerenderDefinition({ sdl: "version: '2.0'", name: undefined, source: "api" });
      dependencies.WarningCircle.mockClear();
      rerenderDefinition({ sdl: "version: '2.0'", name: undefined, source: "api" });

      expect(dependencies.WarningCircle).not.toHaveBeenCalled();
    });

    it("stops rendering once the api's copy is confirmed current, even while the editor holds unsaved edits", async () => {
      const { dependencies, rerenderDefinition } = setup({
        definition: { sdl: "version: '2.0'", source: "local" },
        deployment: { dseq: "123", state: "active", hash: "on-chain-hash" },
        dependencies: { deploymentData: mock<typeof DEPENDENCIES.deploymentData>({ getManifestVersion: vi.fn().mockResolvedValue("a-different-hash") }) }
      });

      await waitFor(() => expect(dependencies.WarningCircle).toHaveBeenCalled());

      rerenderDefinition({ sdl: "version: '2.0'", name: undefined, source: "api" }, { editedManifest: "version: '2.0' # user edit" });
      dependencies.WarningCircle.mockClear();
      rerenderDefinition({ sdl: "version: '2.0'", name: undefined, source: "api" }, { editedManifest: "version: '2.0' # user edit" });

      expect(dependencies.WarningCircle).not.toHaveBeenCalled();
    });

    it("does not render for a copy whose values the api withheld", async () => {
      const { dependencies } = setup({
        definition: { sdl: WITHHELD_VALUES_SDL, source: "absent" },
        deployment: { dseq: "123", state: "active", hash: "on-chain-hash" },
        dependencies: { deploymentData: mock<typeof DEPENDENCIES.deploymentData>({ getManifestVersion: vi.fn().mockResolvedValue("a-different-hash") }) }
      });

      await continuePastTheNotice(dependencies);

      expect(dependencies.WarningCircle).not.toHaveBeenCalled();
    });

    it("does not render for a browser copy that agrees with the chain", async () => {
      const { dependencies } = setup({
        definition: { sdl: "version: '2.0'", source: "local" },
        deployment: { dseq: "123", state: "active", hash: "same-hash" },
        dependencies: { deploymentData: mock<typeof DEPENDENCIES.deploymentData>({ getManifestVersion: vi.fn().mockResolvedValue("same-hash") }) }
      });

      await waitFor(() => expect(dependencies.SDLEditor).toHaveBeenCalled());
      expect(dependencies.WarningCircle).not.toHaveBeenCalled();
    });
  });

  describe("a definition whose secret values the api withheld", () => {
    it("displays it unchanged and says the values are withheld", async () => {
      const onManifestChange = vi.fn();
      setup({ definition: { sdl: WITHHELD_VALUES_SDL, source: "absent" }, onManifestChange });

      expect(screen.getByText(/secret values withheld/i)).toBeInTheDocument();
      await waitFor(() => expect(onManifestChange).toHaveBeenCalledWith(WITHHELD_VALUES_SDL));
    });

    it("disables the update action", () => {
      const { dependencies } = setup({ editedManifest: WITHHELD_VALUES_SDL });

      expect(updateButtonOf(dependencies)?.disabled).toBe(true);
    });

    it("submits nothing when the update action fires anyway", async () => {
      const handles = setup({
        editedManifest: WITHHELD_VALUES_SDL,
        deployment: { dseq: "123", state: "active", hash: "different-hash" }
      });

      await clickUpdate(handles);

      expect(handles.mutate).not.toHaveBeenCalled();
      expect(screen.getByText(/withheld secret values/i)).toBeInTheDocument();
    });

    it("disables the update action when the values were withheld by blanking them", async () => {
      const { dependencies } = setup({ editedManifest: BLANK_ENV_VALUES_SDL, definition: { sdl: BLANK_ENV_VALUES_SDL, source: "absent" } });

      await continuePastTheNotice(dependencies);

      expect(updateButtonOf(dependencies)?.disabled).toBe(true);
    });

    it("submits nothing when the update action fires with blanked values", async () => {
      const handles = setup({
        editedManifest: BLANK_ENV_VALUES_SDL,
        definition: { sdl: BLANK_ENV_VALUES_SDL, source: "absent" },
        deployment: { dseq: "123", state: "active", hash: "different-hash" }
      });

      await continuePastTheNotice(handles.dependencies);
      await clickUpdate(handles);

      expect(handles.mutate).not.toHaveBeenCalled();
      expect(screen.getByText(/withheld secret values/i)).toBeInTheDocument();
    });

    it("says why the update action is unavailable without waiting for it to be used", () => {
      setup({ editedManifest: WITHHELD_VALUES_SDL });

      expect(screen.getByText(/withheld secret values/i)).toBeInTheDocument();
    });

    it("shows the notice again once another deployment's definition resolves", async () => {
      const { dependencies, rerenderDefinition } = setup({ definition: { sdl: WITHHELD_VALUES_SDL, source: "absent" }, deployment: { dseq: "123" } });

      await continuePastTheNotice(dependencies);

      expect(screen.queryByText(/secret values withheld/i)).not.toBeInTheDocument();

      rerenderDefinition({ sdl: WITHHELD_VALUES_SDL, name: undefined, source: "absent" }, { deployment: { dseq: "456" } });

      expect(screen.getByText(/secret values withheld/i)).toBeInTheDocument();
    });
  });

  it("keeps the update action available for a browser copy whose env value is deliberately blank", async () => {
    const { dependencies } = setup({ editedManifest: BLANK_ENV_VALUES_SDL, definition: { sdl: BLANK_ENV_VALUES_SDL, source: "local" } });

    await waitFor(() => expect(updateButtonOf(dependencies)?.disabled).toBe(false));
  });

  it("seeds another deployment's definition even when the previous one held unsaved edits", async () => {
    const onManifestChange = vi.fn();
    const { rerenderDefinition } = setup({ definition: { sdl: "version: '2.0' # first", source: "local" }, deployment: { dseq: "123" }, onManifestChange });

    await waitFor(() => expect(onManifestChange).toHaveBeenCalledWith("version: '2.0' # first"));

    rerenderDefinition(
      { sdl: "version: '2.0' # second", name: undefined, source: "local" },
      { deployment: { dseq: "456" }, editedManifest: "version: '2.0' # unsaved edit" }
    );

    await waitFor(() => expect(onManifestChange).toHaveBeenCalledWith("version: '2.0' # second"));
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
    const { dependencies } = setup({ onManifestChange, definition: { sdl: "version: '2.0'", source: "local" } });

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
  type Overrides = { editedManifest?: string; deployment?: Partial<{ dseq: string; state: string; hash: string }> };

  function editorChangeEvent() {
    return mock<Parameters<NonNullable<Parameters<typeof DEPENDENCIES.SDLEditor>[0]["onChange"]>>[1]>();
  }

  function updateButtonOf(dependencies: Dependencies) {
    return dependencies.Button.mock.calls.filter(call => call[0].children === "Update Deployment").at(-1)?.[0];
  }

  function redeployButtonOf(dependencies: Dependencies, onRedeploy: () => void) {
    return dependencies.Button.mock.calls.filter(call => call[0].onClick === onRedeploy).at(-1)?.[0];
  }

  async function continuePastTheNotice(dependencies: Dependencies) {
    const continueButton = dependencies.Button.mock.calls.filter(call => call[0].children === "Continue").at(-1)?.[0];

    await act(async () => {
      continueButton?.onClick?.(mock<MouseEvent<HTMLButtonElement>>());
    });
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
    definition?: Partial<DeploymentDefinition>;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const providerProxy = mock<ProviderProxyService>();
    const analyticsService = mock<AnalyticsService>();
    const logger = mock<LoggerService>();
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

    let definition: DeploymentDefinition = { sdl: "version: '2.0'", name: undefined, source: "local", ...input?.definition };
    const useDeploymentDefinition: typeof DEPENDENCIES.useDeploymentDefinition = () => definition;

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
      useDeploymentDefinition,
      deploymentData: mock<typeof DEPENDENCIES.deploymentData>({
        getManifestVersion: vi.fn().mockResolvedValue("test-version")
      }),
      ...input?.dependencies
    });

    const closeManifestEditor = input?.closeManifestEditor || vi.fn();
    const onManifestChange = input?.onManifestChange || vi.fn();

    const componentWith = (overrides?: Overrides) => (
      <TestContainerProvider
        services={{
          api: () => api,
          providerProxy: () => providerProxy,
          analyticsService: () => analyticsService,
          deploymentLocalStorage: () => deploymentLocalStorage,
          logger: () => logger
        }}
      >
        <ManifestUpdate
          deployment={
            {
              dseq: "123",
              state: "active",
              hash: "abc",
              ...input?.deployment,
              ...overrides?.deployment
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
      rerenderWith: (overrides: Overrides) => rerender(componentWith(overrides)),
      rerenderDefinition: (next: DeploymentDefinition, overrides?: Overrides) => {
        definition = next;
        rerender(componentWith(overrides));
      },
      providerProxy,
      analyticsService,
      deploymentLocalStorage,
      logger,
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
