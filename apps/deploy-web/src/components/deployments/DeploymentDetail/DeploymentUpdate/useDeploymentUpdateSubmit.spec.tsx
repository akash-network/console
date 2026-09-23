import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import { importDeploymentState } from "@src/components/deployments/ConfigureDeployment/importDeploymentState/importDeploymentState";
import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { SdlBuilderFormValuesType } from "@src/types";
import { DEPENDENCIES } from "./useDeploymentUpdateSubmit";
import { useDeploymentUpdateSubmit } from "./useDeploymentUpdateSubmit";

import { act, waitFor } from "@testing-library/react";
import { buildWallet } from "@tests/seeders/wallet";
import { MockComponents } from "@tests/unit/mocks";
import { setupQuery } from "@tests/unit/query-client";

const STORED_SDL = `
version: "2.0"
services:
  web:
    image: nginx:1.25
    env:
      - MODE=dev
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 1Gi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

const DSEQ = "12345";
const RECORDED_VERSION = "cmVjb3JkZWQ=";
const SEAL = "sealed.jwe.aaa.bbb.ccc";
const DEFINITION_CHANGED = new ApiError(
  409,
  { message: "Deployment definition changed concurrently, please retry", code: "deployment_definition_changed" },
  "PATCH /v1/deployments/{dseq} → 409"
);
const STALE_PROVIDER_MESSAGE =
  "Your update was accepted, but the provider has not picked it up yet. Wait a minute and try again. If it keeps failing, change any other value (such as an environment variable) along with your change so the provider receives a fresh update, or contact support.";
const PROVIDER_BEHIND = new ApiError(409, { message: STALE_PROVIDER_MESSAGE, code: "provider_manifest_version_stale" }, "PATCH /v1/deployments/{dseq} → 409");
const STALE_SEAL = new ApiError(409, { message: "The sealing key is no longer current" }, "PATCH /v1/deployments/{dseq} → 409");
const BAD_SDL = new ApiError(400, { message: "Invalid SDL: the image is not a valid reference" }, "PATCH /v1/deployments/{dseq} → 400");
const OUT_OF_CREDITS = new ApiError(402, { message: "Insufficient balance: top up to keep deploying" }, "PATCH /v1/deployments/{dseq} → 402");
const SERVER_FAILURE = new ApiError(500, { message: "The SDL recorded for this deployment cannot be read" }, "PATCH /v1/deployments/{dseq} → 500");

describe(useDeploymentUpdateSubmit.name, () => {
  it("sends nothing and says so when nothing changed", async () => {
    const { result, patchMutate, enqueueSnackbar, seed } = setup();

    act(() => result.current.submit(seed, seed));

    expect(patchMutate).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Nothing to update"), expect.objectContaining({ variant: "info" }));
  });

  it("reports nothing running before anything is submitted", () => {
    const { result } = setup();

    expect(result.current.isUpdating).toBe(false);
    expect(result.current.sdlRefusal).toBeNull();
  });

  it("patches only what changed, sealed and guarded on the version the form was seeded from", async () => {
    const { result, patchMutate, sealSdlSecrets, seed } = setup();

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

    await waitFor(() => expect(patchMutate).toHaveBeenCalled());
    expect(patchMutate).toHaveBeenCalledWith({
      dseq: DSEQ,
      data: { services: { web: { image: "nginx:1.27" } }, sealedSecrets: SEAL, ifManifestVersion: RECORDED_VERSION }
    });
    expect(sealSdlSecrets).toHaveBeenCalledWith({ context: expect.anything(), secrets: {} });
  });

  it("still reports an update that lands after the tab has closed", async () => {
    const { result, patchMutate, enqueueSnackbar, onUpdated, unmount, landPatch, seed } = setup({ patchOutcome: "deferred" });
    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));
    await waitFor(() => expect(patchMutate).toHaveBeenCalled());

    unmount();
    await act(async () => landPatch());

    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Deployment updated"), expect.objectContaining({ variant: "success" }));
  });

  it("reports the update as running until the api answers", async () => {
    const { result, patchMutate, seed } = setup({ patchOutcome: "pending" });

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

    await waitFor(() => expect(patchMutate).toHaveBeenCalled());
    expect(result.current.isUpdating).toBe(true);
  });

  describe("when the api accepts the patch", () => {
    it("refreshes what the api holds for the deployment and tells the page", async () => {
      const { result, queryClient, api, onUpdated, seed } = setup();

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() => expect(onUpdated).toHaveBeenCalled());
      expect(onUpdated).toHaveBeenCalledWith({ values: withImage(seed, "nginx:1.27"), manifestVersion: "bmV3" });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.getDeployment.getKey({ dseq: DSEQ }) });
      expect(result.current.isUpdating).toBe(false);
    });

    it("confirms the update and counts it", async () => {
      const { result, enqueueSnackbar, analyticsService, refetchBalances, seed } = setup();

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Deployment updated"), expect.objectContaining({ variant: "success" })));
      expect(analyticsService.track).toHaveBeenCalledWith("update_deployment", { category: "deployments", label: "Update deployment" });
      expect(analyticsService.track).toHaveBeenCalledWith("successful_tx", { category: "transactions", label: "Successful transaction" });
      expect(refetchBalances).toHaveBeenCalled();
    });
  });

  describe("when the definition changed elsewhere since the form loaded", () => {
    it("reloads the form from what the api now holds", async () => {
      const { result, onDefinitionChanged, queryClient, api, seed } = setup({ patchOutcome: DEFINITION_CHANGED });

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() => expect(onDefinitionChanged).toHaveBeenCalled());
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.getDeployment.getKey({ dseq: DSEQ }) }, { throwOnError: true });
    });

    it("lets the form go when the reload itself fails", async () => {
      const { result, onDefinitionReloadFailed, queryClient, seed } = setup({ patchOutcome: DEFINITION_CHANGED });
      queryClient.invalidateQueries.mockRejectedValue(new Error("getDeployment 503"));

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() => expect(onDefinitionReloadFailed).toHaveBeenCalled());
    });

    it("keeps the form waiting for a reload that succeeds", async () => {
      const { result, onDefinitionChanged, onDefinitionReloadFailed, queryClient, seed } = setup({ patchOutcome: DEFINITION_CHANGED });

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() => expect(onDefinitionChanged).toHaveBeenCalled());
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["getDeployment", DSEQ] }, { throwOnError: true });
      expect(onDefinitionReloadFailed).not.toHaveBeenCalled();
    });

    it("waits for the reload before saying the form shows the current configuration", async () => {
      const { result, enqueueSnackbar, queryClient, onDefinitionChanged, seed } = setup({ patchOutcome: DEFINITION_CHANGED });
      let landReload: () => void = () => undefined;
      queryClient.invalidateQueries.mockReturnValue(new Promise<void>(resolve => (landReload = resolve)));

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));
      await waitFor(() => expect(onDefinitionChanged).toHaveBeenCalled());
      expect(enqueueSnackbar).not.toHaveBeenCalled();
      await act(async () => landReload());

      expect(enqueueSnackbar).toHaveBeenCalledWith(
        snackbarSaying("This deployment was updated elsewhere, so the form now shows its current configuration. Make your changes again."),
        expect.objectContaining({ variant: "warning" })
      );
    });

    it("says the current configuration could not be loaded when the reload fails", async () => {
      const { result, enqueueSnackbar, queryClient, seed } = setup({ patchOutcome: DEFINITION_CHANGED });
      queryClient.invalidateQueries.mockRejectedValue(new Error("getDeployment 503"));

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith(
          snackbarSaying("This deployment was updated elsewhere, and its current configuration could not be loaded. Reload the page before making changes."),
          expect.objectContaining({ variant: "warning" })
        )
      );
      expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    });

    it("explains why, without resealing", async () => {
      const { result, enqueueSnackbar, sealSdlSecrets, seed } = setup({ patchOutcome: DEFINITION_CHANGED });

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Changed elsewhere"), expect.objectContaining({ variant: "warning" })));
      expect(sealSdlSecrets).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the chain took the update but the provider has yet to apply it", () => {
    it("sends the patch once, without resealing", async () => {
      const { result, patchMutate, sealSdlSecrets, enqueueSnackbar, seed } = setup({ patchOutcome: PROVIDER_BEHIND });

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
      expect(patchMutate).toHaveBeenCalledTimes(1);
      expect(sealSdlSecrets).toHaveBeenCalledTimes(1);
    });

    it("warns in the api's words until the warning is dismissed", async () => {
      const { result, enqueueSnackbar, seed } = setup({ patchOutcome: PROVIDER_BEHIND });

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith(
          expect.objectContaining({
            props: expect.objectContaining({ title: `Update to deployment ${DSEQ} not applied yet`, subTitle: STALE_PROVIDER_MESSAGE, iconVariant: "warning" })
          }),
          { variant: "warning", autoHideDuration: null }
        )
      );
    });

    it("falls back to a general notice when the api gave no guidance", async () => {
      const { result, enqueueSnackbar, seed } = setup({
        patchOutcome: new ApiError(409, { code: "provider_manifest_version_stale" }, "PATCH /v1/deployments/{dseq} → 409")
      });

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith(
          expect.objectContaining({
            props: expect.objectContaining({ subTitle: "Your update was accepted, but the provider has not picked it up yet. Wait a minute and try again." })
          }),
          expect.anything()
        )
      );
    });

    it("reloads the form from the definition the update left behind, without saying it changed elsewhere", async () => {
      const { result, enqueueSnackbar, queryClient, onUpdated, onDefinitionChanged, seed } = setup({ patchOutcome: PROVIDER_BEHIND });

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() => expect(onDefinitionChanged).toHaveBeenCalled());
      await act(async () => undefined);

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["getDeployment", DSEQ] }, { throwOnError: true });
      expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
      expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled(`Update to deployment ${DSEQ} not applied yet`), expect.anything());
      expect(onUpdated).not.toHaveBeenCalled();
      expect(result.current.isUpdating).toBe(false);
    });

    it("lets the form go when that reload fails", async () => {
      const { result, onDefinitionReloadFailed, queryClient, seed } = setup({ patchOutcome: PROVIDER_BEHIND });
      queryClient.invalidateQueries.mockRejectedValue(new Error("getDeployment 503"));

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() => expect(onDefinitionReloadFailed).toHaveBeenCalled());
    });

    it("refreshes the balances but leaves the update out of the failed transactions", async () => {
      const { result, enqueueSnackbar, analyticsService, refetchBalances, seed } = setup({ patchOutcome: PROVIDER_BEHIND });

      act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

      await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
      expect(refetchBalances).toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalledWith("failed_tx", expect.anything());
    });
  });

  it("reseals once when the api refuses a seal made against a retired key", async () => {
    const { result, patchMutate, sealSdlSecrets, seed } = setup({ patchOutcomes: [STALE_SEAL, "success"] });

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

    await waitFor(() => expect(patchMutate).toHaveBeenCalledTimes(2));
    expect(sealSdlSecrets).toHaveBeenCalledTimes(2);
  });

  it("stops after one reseal and reports the refusal", async () => {
    const { result, patchMutate, enqueueSnackbar, seed } = setup({ patchOutcomes: [STALE_SEAL, STALE_SEAL] });

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Error"), expect.objectContaining({ variant: "error" })));
    expect(patchMutate).toHaveBeenCalledTimes(2);
  });

  it("hands a refusal of the document itself back for the form to show", async () => {
    const { result, enqueueSnackbar, seed } = setup({ patchOutcome: BAD_SDL });

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

    await waitFor(() => expect(result.current.sdlRefusal).toBe("Invalid SDL: the image is not a valid reference"));
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("clears a refusal the form showed once the next update is submitted", async () => {
    const { result, seed } = setup({ patchOutcomes: [BAD_SDL, "pending"] });
    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));
    await waitFor(() => expect(result.current.sdlRefusal).not.toBeNull());

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.28")));

    expect(result.current.sdlRefusal).toBeNull();
  });

  it("refreshes the balances after a failed update, which may still have spent a fee", async () => {
    const { result, refetchBalances, seed } = setup({ patchOutcome: SERVER_FAILURE });

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

    await waitFor(() => expect(refetchBalances).toHaveBeenCalled());
  });

  it("falls back to a general message for a failure the api did not explain", async () => {
    const { result, enqueueSnackbar, seed } = setup({ patchOutcome: new ApiError(500, {}, "PATCH /v1/deployments/{dseq} → 500") });

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ subTitle: "Something went wrong while updating the deployment. Please try again." }) }),
        expect.anything()
      )
    );
  });

  it("dismisses the credits offer once its action is taken", async () => {
    const { result, enqueueSnackbar, closeSnackbar, seed } = setup({ patchOutcome: OUT_OF_CREDITS });

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));
    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
    enqueueSnackbar.mock.calls[0][0].props.subTitle.props.onAction();

    expect(closeSnackbar).toHaveBeenCalledWith("snackbar-key");
  });

  it("offers credits when the account cannot pay for the update", async () => {
    const { result, enqueueSnackbar, seed } = setup({ patchOutcome: OUT_OF_CREDITS });

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Insufficient balance"), expect.objectContaining({ variant: "warning" })));
  });

  it("keeps any other failure on screen and counts it as a failed transaction", async () => {
    const { result, enqueueSnackbar, analyticsService, seed } = setup({ patchOutcome: SERVER_FAILURE });

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Error"), expect.objectContaining({ variant: "error", autoHideDuration: null }))
    );
    expect(analyticsService.track).toHaveBeenCalledWith("failed_tx", { category: "transactions", label: "Failed transaction" });
  });

  it("leaves a client refusal out of the failed transactions", async () => {
    const { result, analyticsService, seed } = setup({ patchOutcome: BAD_SDL });

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

    await waitFor(() => expect(result.current.sdlRefusal).not.toBeNull());
    expect(analyticsService.track).not.toHaveBeenCalledWith("failed_tx", expect.anything());
  });

  it("reports a seal it could not make, and patches nothing", async () => {
    const { result, patchMutate, enqueueSnackbar, seed } = setup({ sealFailure: new Error("key service unreachable") });

    act(() => result.current.submit(seed, withImage(seed, "nginx:1.27")));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Error"), expect.objectContaining({ variant: "error" })));
    expect(patchMutate).not.toHaveBeenCalled();
    expect(result.current.isUpdating).toBe(false);
  });

  function snackbarTitled(title: string) {
    return expect.objectContaining({ props: expect.objectContaining({ title }) });
  }

  function snackbarSaying(subTitle: string) {
    return expect.objectContaining({ props: expect.objectContaining({ title: "Changed elsewhere", subTitle }) });
  }

  function withImage(values: SdlBuilderFormValuesType, image: string): SdlBuilderFormValuesType {
    const edited = structuredClone(values);
    edited.services[0].image = image;
    return edited;
  }

  function setup(
    input: {
      patchOutcome?: ApiError | "success" | "pending" | "deferred";
      patchOutcomes?: Array<ApiError | "success" | "pending" | "deferred">;
      sealFailure?: Error;
    } = {}
  ) {
    const seed = importDeploymentState(STORED_SDL).values;
    const outcomes = [...(input.patchOutcomes ?? [input.patchOutcome ?? "success"])];
    let settleLanded: (() => void) | undefined;
    const patchMutate = vi.fn((_variables: unknown) => {
      const outcome = outcomes.length > 1 ? outcomes.shift() : outcomes[0];
      if (outcome === "pending") return new Promise(() => undefined);
      if (outcome === "deferred") return new Promise(resolve => (settleLanded = () => resolve({ data: { manifestVersion: "bmV3" } })));
      if (outcome === "success") return Promise.resolve({ data: { manifestVersion: "bmV3" } });
      return Promise.reject(outcome);
    });

    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.getDeployment.getKey.mockImplementation(request => ["getDeployment", request?.dseq ?? ""]);
    api.v1.patchDeployment.useMutation.mockReturnValue(mock<ReturnType<typeof api.v1.patchDeployment.useMutation>>({ mutateAsync: patchMutate as never }));
    const contextMutateAsync = input.sealFailure
      ? vi.fn().mockRejectedValue(input.sealFailure)
      : vi.fn().mockResolvedValue({ data: { kid: "kid", sub: "user" } });
    api.v1.getSDLSecretsContext.useMutation.mockReturnValue(
      mock<ReturnType<typeof api.v1.getSDLSecretsContext.useMutation>>({ mutateAsync: contextMutateAsync as never })
    );
    const analyticsService = mock<AppDIContainer["analyticsService"]>();

    const enqueueSnackbar = vi.fn().mockReturnValue("snackbar-key");
    const closeSnackbar = vi.fn();
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();
    queryClient.invalidateQueries.mockResolvedValue(undefined);
    const refetchBalances = vi.fn();
    const sealSdlSecrets = vi.fn().mockResolvedValue(SEAL);
    const onUpdated = vi.fn();
    const onDefinitionChanged = vi.fn();
    const onDefinitionReloadFailed = vi.fn();
    const dependencies = MockComponents(DEPENDENCIES, {
      useWallet: () => buildWallet({ address: "akash1owner" }),
      useBalances: () => mock<ReturnType<typeof DEPENDENCIES.useBalances>>({ refetch: refetchBalances as never }),
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar }),
      useQueryClient: () => queryClient,
      sealSdlSecrets
    });

    const { result, unmount } = setupQuery(
      () =>
        useDeploymentUpdateSubmit({ dseq: DSEQ, manifestVersion: RECORDED_VERSION, onUpdated, onDefinitionChanged, onDefinitionReloadFailed }, dependencies),
      { services: { api: () => api, analyticsService: () => analyticsService } }
    );

    return {
      result,
      unmount,
      landPatch: () => settleLanded?.(),
      seed,
      api,
      patchMutate,
      sealSdlSecrets,
      enqueueSnackbar,
      closeSnackbar,
      queryClient,
      refetchBalances,
      analyticsService,
      onUpdated,
      onDefinitionChanged,
      onDefinitionReloadFailed
    };
  }
});
