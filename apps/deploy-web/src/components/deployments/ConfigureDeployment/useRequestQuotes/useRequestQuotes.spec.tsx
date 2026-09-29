import type { PropsWithChildren, ReactNode } from "react";
import type { FieldErrors } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { Snackbar } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { resolveSdlSecrets } from "@src/utils/sdl/sdlSecrets";
import type { DeploymentFlow, DeploymentFlowActions } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./useRequestQuotes";
import { useRequestQuotes } from "./useRequestQuotes";

import { act, render, renderHook, screen } from "@testing-library/react";

const GENERATED_SDL = 'version: "2.0" # generated';

describe(useRequestQuotes.name, () => {
  it("requests quotes with the SDL generated from the submitted form values", async () => {
    const { requestQuotes, submit, enqueueSnackbar } = setup({});

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { name: "" });
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("requests quotes under the name typed for the deployment", async () => {
    const { requestQuotes, submit } = setup({ deploymentName: "my-app" });

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { name: "my-app" });
  });

  it("blocks a trial deployment whose GPU resolves to a blocked selection and explains why", async () => {
    const { requestQuotes, submit, enqueueSnackbar } = setup({
      isRestricted: true,
      services: [{ profile: { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "" }] } }]
    });

    await submit();

    expect(requestQuotes).not.toHaveBeenCalled();
    render(enqueueSnackbar.mock.calls[0][0] as ReactNode);
    expect(screen.getByText(/GPU access is not available on a free trial/i)).toBeInTheDocument();
  });

  it("lets a trial deployment on an allowed GPU model request quotes", async () => {
    const { requestQuotes, submit } = setup({
      isRestricted: true,
      services: [{ profile: { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "t4" }] } }]
    });

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { name: "" });
  });

  it("applies no trial GPU guard for a user who is not on a trial", async () => {
    const { requestQuotes, submit } = setup({
      isRestricted: false,
      services: [{ profile: { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "" }] } }]
    });

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { name: "" });
  });

  it("seals credentials in the generated SDL and hands the typed secret values to the flow when the secrets feature is on", async () => {
    const { requestQuotes, submit, generateSdl } = setup({
      secretsEnabled: true,
      resolveSdlSecrets: () => ({ references: new Map(), values: { API_KEY: "hunter2" }, unresolved: [] })
    });

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { name: "", secrets: { API_KEY: "hunter2" } });
    expect(generateSdl).toHaveBeenCalledWith(expect.anything(), { sealSecrets: true });
  });

  it("treats the redeploy source's secrets as held and names the source on the request", async () => {
    const resolveSdlSecretsSpy = vi.fn(() => ({ references: new Map(), values: {}, unresolved: [] }));
    const { requestQuotes, submit } = setup({
      secretsEnabled: true,
      resolveSdlSecrets: resolveSdlSecretsSpy,
      inheritedSecrets: { sourceDseq: "123", names: new Set(["API_KEY"]) }
    });

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { name: "", secrets: {}, inheritSecretsFrom: "123" });
    expect(resolveSdlSecretsSpy).toHaveBeenCalledWith(expect.anything(), { sealSecrets: true, heldNames: new Set(["API_KEY"]) });
  });

  it("refuses to request quotes while a secret still needs a value, naming the secret and its service", async () => {
    const { requestQuotes, submit, enqueueSnackbar } = setup({
      secretsEnabled: true,
      resolveSdlSecrets: () => ({
        references: new Map(),
        values: {},
        unresolved: [{ serviceTitle: "web", label: "API_KEY", name: "API_KEY", isKeptReference: false }]
      })
    });

    await submit();

    expect(requestQuotes).not.toHaveBeenCalled();
    render(enqueueSnackbar.mock.calls[0][0] as ReactNode);
    expect(screen.getByText('Secret "API_KEY" in service "web" needs a value.')).toBeInTheDocument();
  });

  it("keeps credentials as typed and hands no secrets to the flow while the secrets feature is off", async () => {
    const { requestQuotes, submit, generateSdl } = setup({});

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { name: "" });
    expect(generateSdl).toHaveBeenCalledWith(expect.anything(), { sealSecrets: false });
  });

  it("hands the validation errors to the caller when the form rejects the submit", async () => {
    const onInvalid = vi.fn();
    const { requestQuotes, submit } = setup({ onInvalid, rejectWith: { services: { 0: { image: { type: "manual", message: "Image is required" } } } } });

    await submit();

    expect(requestQuotes).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledWith(expect.objectContaining({ services: { 0: { image: expect.objectContaining({ message: "Image is required" }) } } }));
  });

  it("names the missing fields and their service when the form rejects the submit", async () => {
    const { submit, enqueueSnackbar } = setup({
      services: [{ title: "web", profile: {} }],
      rejectWith: { services: { 0: { image: { type: "manual", message: "Docker image name is required." } } } }
    });

    await submit();

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" });
    render(enqueueSnackbar.mock.calls[0][0] as ReactNode);
    expect(screen.getByText("Your deployment can't be submitted yet")).toBeInTheDocument();
    expect(screen.getByText("web: Docker image name is required.")).toBeInTheDocument();
  });

  it("surfaces SDL validation errors and does not request quotes when the spec is invalid", async () => {
    const { requestQuotes, submit, enqueueSnackbar } = setup({ validationErrors: ["/services/web/params/tee: missing required property 'gpu'"] });

    await submit();

    expect(requestQuotes).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" });
    render(enqueueSnackbar.mock.calls[0][0] as ReactNode);
    expect(screen.getByText("Your deployment can't be submitted yet")).toBeInTheDocument();
    expect(screen.getByText("/services/web/params/tee: missing required property 'gpu'")).toBeInTheDocument();
  });

  function setup(input: {
    deploymentName?: string;
    validationErrors?: string[];
    isRestricted?: boolean;
    services?: Array<{ title?: string; profile: { hasGpu?: boolean; gpuModels?: Array<{ vendor: string; name?: string }> } }>;
    secretsEnabled?: boolean;
    resolveSdlSecrets?: typeof DEPENDENCIES.resolveSdlSecrets;
    inheritedSecrets?: ReturnType<typeof DEPENDENCIES.useInheritedSecrets>;
    onInvalid?: (errors: FieldErrors) => void;
    rejectWith?: FieldErrors;
  }) {
    const requestQuotes = vi.fn();
    const flow = mock<DeploymentFlow>({ actions: mock<DeploymentFlowActions>({ requestQuotes }) });
    const enqueueSnackbar = vi.fn();
    const generateSdl = vi.fn(() => GENERATED_SDL);
    const dependencies: typeof DEPENDENCIES = {
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      Snackbar,
      generateSdl,
      validateGeneratedSdl: () => input.validationErrors ?? [],
      resolveSdlSecrets: input.resolveSdlSecrets ?? resolveSdlSecrets,
      useFlag: () => input.secretsEnabled ?? false,
      useInheritedSecrets: () => input.inheritedSecrets ?? null,
      useTrialGate: () => ({ isRestricted: input.isRestricted ?? false, isWalletReady: true })
    };
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm({
        defaultValues: { placements: [], services: input.services ?? [] },
        resolver: input.rejectWith ? async () => ({ values: {}, errors: input.rejectWith as FieldErrors }) : undefined
      });
      return <FormProvider {...form}>{children}</FormProvider>;
    };
    const { result } = renderHook(() => useRequestQuotes({ flow, deploymentName: input.deploymentName ?? "", onInvalid: input.onInvalid }, dependencies), {
      wrapper: Wrapper
    });

    return {
      requestQuotes,
      enqueueSnackbar,
      generateSdl,
      submit: () => act(() => result.current())
    };
  }
});
