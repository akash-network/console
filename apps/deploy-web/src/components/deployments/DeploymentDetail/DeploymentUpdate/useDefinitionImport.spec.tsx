import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { RecordableDefinition } from "@src/utils/sdl/recordableDefinition";
import { DEPENDENCIES, useDefinitionImport } from "./useDefinitionImport";

import { act, waitFor } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";
import { setupQuery } from "@tests/unit/query-client";

const DSEQ = "4321";
const SEAL = "sealed.jwe.aaa.bbb.ccc";
const DEFINITION: RecordableDefinition = { sdl: 'version: "2.0"\nservices: {}\n', secrets: { DATABASE_PASSWORD: "hunter2hunter2" } };
const MISMATCH = new ApiError(
  422,
  { message: "This SDL does not describe what the deployment is running", code: "deployment_definition_mismatch" },
  "POST → 422"
);
const ALREADY_RECORDED = new ApiError(409, { message: "The console already holds a definition", code: "deployment_definition_exists" }, "POST → 409");
const STALE_SEAL = new ApiError(409, { message: "The sealing key is no longer current", code: "conflict" }, "POST → 409");
const MISSING_VALUE = new ApiError(400, { message: 'Invalid SDL: no value supplied for SDL Reference "ac-secret://API_TOKEN"' }, "POST → 400");
const SERVER_FAILURE = new ApiError(500, { message: "Deployment could not be read, please retry" }, "POST → 500");
const PROVIDER_BEHIND = new ApiError(409, { message: "The provider has not picked it up yet", code: "provider_manifest_version_stale" }, "PUT → 409");

describe(useDefinitionImport.name, () => {
  describe("record", () => {
    it("records the definition with its values sealed to the sdl it sends", async () => {
      const { result, createDefinition, sealSdlSecrets } = setup();

      await act(() => result.current.record(DEFINITION));

      expect(sealSdlSecrets).toHaveBeenCalledWith({ context: expect.anything(), sdl: DEFINITION.sdl, secrets: DEFINITION.secrets });
      expect(createDefinition).toHaveBeenCalledWith({ dseq: DSEQ, data: { sdl: DEFINITION.sdl, sealedSecrets: SEAL } });
    });

    it("reloads the definition, confirms and tells the tab once it is recorded", async () => {
      const { result, queryClient, api, enqueueSnackbar, onImported } = setup();

      await act(() => result.current.record(DEFINITION));

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: api.v1.getDeployment.getKey({ dseq: DSEQ }) });
      expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Configuration saved"), expect.objectContaining({ variant: "success" }));
      expect(onImported).toHaveBeenCalled();
    });

    it("reports saving until the api answers", async () => {
      const { result } = setup({ createOutcomes: ["pending"] });

      act(() => void result.current.record(DEFINITION));

      await waitFor(() => expect(result.current.isSaving).toBe(true));
    });

    it("says the sdl does not match what runs, recording nothing and telling the tab nothing", async () => {
      const { result, onImported, enqueueSnackbar } = setup({ createOutcomes: [MISMATCH] });

      await act(() => result.current.record(DEFINITION));

      expect(result.current.mismatch).toBe(true);
      expect(result.current.isSaving).toBe(false);
      expect(onImported).not.toHaveBeenCalled();
      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it("clears a mismatch once another definition is recorded", async () => {
      const { result } = setup({ createOutcomes: [MISMATCH, "success"] });
      await act(() => result.current.record(DEFINITION));

      await act(() => result.current.record(DEFINITION));

      expect(result.current.mismatch).toBe(false);
    });

    it("takes up a definition recorded elsewhere meanwhile instead of failing", async () => {
      const { result, queryClient, enqueueSnackbar, onImported } = setup({ createOutcomes: [ALREADY_RECORDED] });

      await act(() => result.current.record(DEFINITION));

      expect(queryClient.invalidateQueries).toHaveBeenCalled();
      expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Already saved"), expect.objectContaining({ variant: "info" }));
      expect(onImported).toHaveBeenCalled();
    });

    it("reseals once when the api refuses a seal made against a retired key", async () => {
      const { result, createDefinition, sealSdlSecrets, onImported } = setup({ createOutcomes: [STALE_SEAL, "success"] });

      await act(() => result.current.record(DEFINITION));

      expect(createDefinition).toHaveBeenCalledTimes(2);
      expect(sealSdlSecrets).toHaveBeenCalledTimes(2);
      expect(onImported).toHaveBeenCalled();
    });

    it("hands a refusal of the document back for the review to show", async () => {
      const { result, enqueueSnackbar } = setup({ createOutcomes: [MISSING_VALUE] });

      await act(() => result.current.record(DEFINITION));

      expect(result.current.refusal).toBe('Invalid SDL: no value supplied for SDL Reference "ac-secret://API_TOKEN"');
      expect(enqueueSnackbar).not.toHaveBeenCalled();
    });

    it("keeps any other failure on screen", async () => {
      const { result, enqueueSnackbar, onImported } = setup({ createOutcomes: [SERVER_FAILURE] });

      await act(() => result.current.record(DEFINITION));

      expect(enqueueSnackbar).toHaveBeenCalledWith(
        snackbarTitled("Couldn't save the configuration"),
        expect.objectContaining({ variant: "error", autoHideDuration: null })
      );
      expect(onImported).not.toHaveBeenCalled();
    });

    it("reports a seal it could not make, and records nothing", async () => {
      const { result, createDefinition, enqueueSnackbar } = setup({ sealFailure: new Error("key service unreachable") });

      await act(() => result.current.record(DEFINITION));

      expect(createDefinition).not.toHaveBeenCalled();
      expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Couldn't save the configuration"), expect.objectContaining({ variant: "error" }));
      expect(result.current.isSaving).toBe(false);
    });
  });

  describe("applyAsUpdate", () => {
    it("updates the deployment with the definition, its values sealed to the sdl it sends", async () => {
      const { result, updateDeployment, sealSdlSecrets } = setup();

      await act(() => result.current.applyAsUpdate(DEFINITION));

      expect(sealSdlSecrets).toHaveBeenCalledWith({ context: expect.anything(), sdl: DEFINITION.sdl, secrets: DEFINITION.secrets });
      expect(updateDeployment).toHaveBeenCalledWith({ dseq: DSEQ, data: { sdl: DEFINITION.sdl, sealedSecrets: SEAL } });
    });

    it("reloads the definition, confirms, counts and tells the tab once the update lands", async () => {
      const { result, queryClient, enqueueSnackbar, analyticsService, onImported } = setup();

      await act(() => result.current.applyAsUpdate(DEFINITION));

      expect(queryClient.invalidateQueries).toHaveBeenCalled();
      expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Deployment updated"), expect.objectContaining({ variant: "success" }));
      expect(analyticsService.track).toHaveBeenCalledWith("update_deployment", { category: "deployments", label: "Update deployment" });
      expect(onImported).toHaveBeenCalled();
    });

    it("reseals once when the api refuses a seal made against a retired key", async () => {
      const { result, updateDeployment } = setup({ updateOutcomes: [STALE_SEAL, "success"] });

      await act(() => result.current.applyAsUpdate(DEFINITION));

      expect(updateDeployment).toHaveBeenCalledTimes(2);
    });

    it("warns when the update landed but the provider has yet to apply it, and still takes up the definition", async () => {
      const { result, updateDeployment, enqueueSnackbar, onImported } = setup({ updateOutcomes: [PROVIDER_BEHIND] });

      await act(() => result.current.applyAsUpdate(DEFINITION));

      expect(updateDeployment).toHaveBeenCalledTimes(1);
      expect(enqueueSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ props: expect.objectContaining({ subTitle: "The provider has not picked it up yet", iconVariant: "warning" }) }),
        expect.objectContaining({ variant: "warning" })
      );
      expect(onImported).toHaveBeenCalled();
    });

    it("keeps a failure on screen and leaves the tab as it was", async () => {
      const { result, enqueueSnackbar, onImported } = setup({ updateOutcomes: [SERVER_FAILURE] });

      await act(() => result.current.applyAsUpdate(DEFINITION));

      expect(enqueueSnackbar).toHaveBeenCalledWith(snackbarTitled("Couldn't update the deployment"), expect.objectContaining({ variant: "error" }));
      expect(onImported).not.toHaveBeenCalled();
    });
  });

  describe("clearRefusals", () => {
    it("drops a mismatch", async () => {
      const { result } = setup({ createOutcomes: [MISMATCH] });
      await act(() => result.current.record(DEFINITION));

      act(() => result.current.clearRefusals());

      expect(result.current.mismatch).toBe(false);
    });

    it("drops a refusal", async () => {
      const { result } = setup({ createOutcomes: [MISSING_VALUE] });
      await act(() => result.current.record(DEFINITION));

      act(() => result.current.clearRefusals());

      expect(result.current.refusal).toBeNull();
    });
  });

  function snackbarTitled(title: string) {
    return expect.objectContaining({ props: expect.objectContaining({ title }) });
  }

  function setup(
    input: {
      createOutcomes?: Array<ApiError | "success" | "pending">;
      updateOutcomes?: Array<ApiError | "success">;
      sealFailure?: Error;
    } = {}
  ) {
    const createOutcomes = [...(input.createOutcomes ?? ["success"])];
    const updateOutcomes = [...(input.updateOutcomes ?? ["success"])];
    const createDefinition = vi.fn((_variables: unknown) => settle(createOutcomes.length > 1 ? createOutcomes.shift() : createOutcomes[0]));
    const updateDeployment = vi.fn((_variables: unknown) => settle(updateOutcomes.length > 1 ? updateOutcomes.shift() : updateOutcomes[0]));

    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.getDeployment.getKey.mockImplementation(request => ["getDeployment", request?.dseq ?? ""]);
    api.v1.createDeploymentDefinition.useMutation.mockReturnValue(
      mock<ReturnType<typeof api.v1.createDeploymentDefinition.useMutation>>({ mutateAsync: createDefinition as never })
    );
    api.v1.updateDeployment.useMutation.mockReturnValue(
      mock<ReturnType<typeof api.v1.updateDeployment.useMutation>>({ mutateAsync: updateDeployment as never })
    );
    const contextMutateAsync = input.sealFailure
      ? vi.fn().mockRejectedValue(input.sealFailure)
      : vi.fn().mockResolvedValue({ data: { kid: "kid", sub: "user" } });
    api.v1.getSDLSecretsContext.useMutation.mockReturnValue(
      mock<ReturnType<typeof api.v1.getSDLSecretsContext.useMutation>>({ mutateAsync: contextMutateAsync as never })
    );
    const analyticsService = mock<AppDIContainer["analyticsService"]>();

    const enqueueSnackbar = vi.fn().mockReturnValue("snackbar-key");
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();
    queryClient.invalidateQueries.mockResolvedValue(undefined);
    const sealSdlSecrets = vi.fn().mockResolvedValue(SEAL);
    const onImported = vi.fn();
    const dependencies = MockComponents(DEPENDENCIES, {
      useSnackbar: () => ({ enqueueSnackbar, closeSnackbar: vi.fn() }),
      useQueryClient: () => queryClient,
      sealSdlSecrets
    });

    const { result } = setupQuery(() => useDefinitionImport({ dseq: DSEQ, onImported }, dependencies), {
      services: { api: () => api, analyticsService: () => analyticsService }
    });

    return { result, api, createDefinition, updateDeployment, sealSdlSecrets, enqueueSnackbar, queryClient, analyticsService, onImported };
  }

  function settle(outcome: ApiError | "success" | "pending" | undefined) {
    if (outcome === "pending") return new Promise(() => undefined);
    if (outcome === undefined || outcome === "success") return Promise.resolve({ data: {} });
    return Promise.reject(outcome);
  }
});
