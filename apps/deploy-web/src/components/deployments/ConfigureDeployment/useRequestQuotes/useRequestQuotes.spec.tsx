import type { PropsWithChildren, ReactNode } from "react";
import type { FieldErrors } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { Snackbar } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { resolveSdlSecrets } from "@src/utils/sdl/sdlSecrets";
import type { TrialResourceLimit } from "../ConfigurationPane/HardwareSection/trialResourceLimit/trialResourceLimit";
import type { DeploymentFlow, DeploymentFlowActions } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./useRequestQuotes";
import { useRequestQuotes } from "./useRequestQuotes";

import { act, render, renderHook, screen } from "@testing-library/react";

const GENERATED_SDL = 'version: "2.0" # generated';

describe(useRequestQuotes.name, () => {
  it("requests quotes with the SDL generated from the submitted form values", async () => {
    const { requestQuotes, submit, enqueueSnackbar } = setup({});

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { screening: { placementCount: 0 }, name: "", secrets: {} });
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it("records what screening found for every placement when requesting quotes", async () => {
    const placements = [
      { id: "p1", name: "west", regions: ["na-us-west"] },
      { id: "p2", name: "east" }
    ];
    const { requestQuotes, submit, countScreenedProviders, countNotBiddingProviders } = setup({
      placements,
      screenedProviderCount: 4,
      notBiddingProviderCount: 3
    });

    await submit();

    expect(countScreenedProviders).toHaveBeenCalledWith(GENERATED_SDL, placements);
    expect(countNotBiddingProviders).toHaveBeenCalledWith(GENERATED_SDL, placements);
    expect(requestQuotes).toHaveBeenCalledWith(
      GENERATED_SDL,
      expect.objectContaining({ screening: { placementCount: 2, providerCount: 4, notBiddingProviderCount: 3 } })
    );
  });

  it("requests quotes under the name typed for the deployment", async () => {
    const { requestQuotes, submit } = setup({ deploymentName: "my-app" });

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { screening: { placementCount: 0 }, name: "my-app", secrets: {} });
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

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { screening: { placementCount: 0 }, name: "", secrets: {} });
  });

  it("applies no trial GPU guard for a user who is not on a trial", async () => {
    const { requestQuotes, submit } = setup({
      isRestricted: false,
      services: [{ profile: { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "" }] } }]
    });

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { screening: { placementCount: 0 }, name: "", secrets: {} });
  });

  it("seals credentials in the generated SDL and hands the typed secret values to the flow", async () => {
    const { requestQuotes, submit, generateSdl } = setup({
      resolveSdlSecrets: () => ({ references: new Map(), values: { API_KEY: "hunter2" }, unresolved: [] })
    });

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { screening: { placementCount: 0 }, name: "", secrets: { API_KEY: "hunter2" } });
    expect(generateSdl).toHaveBeenCalledWith(expect.anything(), { sealSecrets: true });
  });

  it("treats the redeploy source's secrets as held and names the source on the request", async () => {
    const resolveSdlSecretsSpy = vi.fn(() => ({ references: new Map(), values: {}, unresolved: [] }));
    const { requestQuotes, submit } = setup({
      resolveSdlSecrets: resolveSdlSecretsSpy,
      inheritedSecrets: { sourceDseq: "123", names: new Set(["API_KEY"]) }
    });

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { screening: { placementCount: 0 }, name: "", secrets: {}, inheritSecretsFrom: "123" });
    expect(resolveSdlSecretsSpy).toHaveBeenCalledWith(expect.anything(), { sealSecrets: true, heldNames: new Set(["API_KEY"]) });
  });

  it("refuses to request quotes while a secret still needs a value, naming the secret and its service", async () => {
    const { requestQuotes, submit, enqueueSnackbar } = setup({
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

  it("blocks a trial deployment over the trial's size cap and explains the cap", async () => {
    const { requestQuotes, submit, enqueueSnackbar } = setup({
      trialResourceLimit: { maxCpu: 4, maxMemoryGi: 16 },
      services: [{ count: 1, profile: { cpu: 16, ram: 64, ramUnit: "Gi" } }]
    });

    await submit();

    expect(requestQuotes).not.toHaveBeenCalled();
    render(enqueueSnackbar.mock.calls[0][0] as ReactNode);
    expect(screen.getByText("Free trial deployments are limited to 4 vCPU and 16 GiB of memory. Add funds to deploy larger workloads.")).toBeInTheDocument();
  });

  it("lets a trial deployment within the trial's size cap request quotes", async () => {
    const { requestQuotes, submit, analyticsService } = setup({
      trialResourceLimit: { maxCpu: 4, maxMemoryGi: 16 },
      services: [{ count: 1, profile: { cpu: 4, ram: 16, ramUnit: "Gi" } }]
    });

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { screening: { placementCount: 0 }, name: "", secrets: {} });
    expect(analyticsService.track).not.toHaveBeenCalled();
  });

  it("applies no size cap when none is in force", async () => {
    const { requestQuotes, submit } = setup({ services: [{ count: 4, profile: { cpu: 96, ram: 512, ramUnit: "Gi" } }] });

    await submit();

    expect(requestQuotes).toHaveBeenCalledWith(GENERATED_SDL, { screening: { placementCount: 0 }, name: "", secrets: {} });
  });

  describe("blocked click analytics", () => {
    it("records the invalid fields by path, without list positions or values, when the form rejects the submit", async () => {
      const { submit, analyticsService } = setup({
        services: [{ title: "web", profile: {} }],
        rejectWith: {
          services: {
            0: { image: { type: "manual", message: "Docker image name is required." } },
            1: { image: { type: "manual", message: "Docker image name is required." }, profile: { cpu: { type: "min", message: "Too few" } } }
          }
        }
      });

      await submit();

      expect(analyticsService.track).toHaveBeenCalledWith("configure_choose_provider_blocked", {
        category: "deployments",
        reasons: ["invalid_field"],
        invalidFields: ["services.image", "services.profile.cpu"]
      });
    });

    it("records an invalid generated SDL", async () => {
      const { submit, analyticsService } = setup({ validationErrors: ["/services/web/params/tee: missing required property 'gpu'"] });

      await submit();

      expect(analyticsService.track).toHaveBeenCalledWith("configure_choose_provider_blocked", { category: "deployments", reasons: ["sdl_invalid"] });
    });

    it("records unresolved secrets once however many are missing", async () => {
      const { submit, analyticsService } = setup({
        resolveSdlSecrets: () => ({
          references: new Map(),
          values: {},
          unresolved: [
            { serviceTitle: "web", label: "API_KEY", name: "API_KEY", isKeptReference: false },
            { serviceTitle: "web", label: "DB_PASSWORD", name: "DB_PASSWORD", isKeptReference: false }
          ]
        })
      });

      await submit();

      expect(analyticsService.track).toHaveBeenCalledWith("configure_choose_provider_blocked", { category: "deployments", reasons: ["unresolved_secret"] });
    });

    it("records a trial GPU block", async () => {
      const { submit, analyticsService } = setup({
        isRestricted: true,
        services: [{ profile: { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "h100" }] } }]
      });

      await submit();

      expect(analyticsService.track).toHaveBeenCalledWith("configure_choose_provider_blocked", { category: "deployments", reasons: ["trial_gpu"] });
    });

    it("records every reason a single click was refused for, and explains each one", async () => {
      const { submit, analyticsService, enqueueSnackbar } = setup({
        isRestricted: true,
        trialResourceLimit: { maxCpu: 4, maxMemoryGi: 16 },
        validationErrors: ["/services/web: invalid"],
        services: [{ count: 1, profile: { hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "h100" }], cpu: 16, ram: 64, ramUnit: "Gi" } }]
      });

      await submit();

      expect(analyticsService.track).toHaveBeenCalledWith("configure_choose_provider_blocked", {
        category: "deployments",
        reasons: ["sdl_invalid", "trial_gpu", "trial_size_limit"]
      });
      render(enqueueSnackbar.mock.calls[0][0] as ReactNode);
      expect(screen.getAllByRole("listitem").map(item => item.textContent)).toEqual([
        "/services/web: invalid",
        "GPU access is not available on a free trial. Add funds to unlock GPU access.",
        "Free trial deployments are limited to 4 vCPU and 16 GiB of memory. Add funds to deploy larger workloads."
      ]);
    });

    it("records nothing for a click that goes on to request quotes", async () => {
      const { submit, analyticsService } = setup({});

      await submit();

      expect(analyticsService.track).not.toHaveBeenCalled();
    });
  });

  function setup(input: {
    deploymentName?: string;
    validationErrors?: string[];
    isRestricted?: boolean;
    trialResourceLimit?: TrialResourceLimit;
    services?: Array<{
      title?: string;
      count?: number;
      profile: { hasGpu?: boolean; gpuModels?: Array<{ vendor: string; name?: string }>; cpu?: number; ram?: number; ramUnit?: string };
    }>;
    resolveSdlSecrets?: typeof DEPENDENCIES.resolveSdlSecrets;
    inheritedSecrets?: ReturnType<typeof DEPENDENCIES.useInheritedSecrets>;
    onInvalid?: (errors: FieldErrors) => void;
    rejectWith?: FieldErrors;
    placements?: Array<{ id: string; name: string; regions?: string[] }>;
    screenedProviderCount?: number;
    notBiddingProviderCount?: number;
  }) {
    const requestQuotes = vi.fn();
    const flow = mock<DeploymentFlow>({ actions: mock<DeploymentFlowActions>({ requestQuotes }) });
    const enqueueSnackbar = vi.fn();
    const analyticsService = mock<AnalyticsService>();
    const generateSdl = vi.fn(() => GENERATED_SDL);
    const countScreenedProviders = vi.fn(() => input.screenedProviderCount);
    const countNotBiddingProviders = vi.fn(() => input.notBiddingProviderCount);
    const dependencies: typeof DEPENDENCIES = {
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar }),
      Snackbar,
      generateSdl,
      validateGeneratedSdl: () => input.validationErrors ?? [],
      resolveSdlSecrets: input.resolveSdlSecrets ?? resolveSdlSecrets,
      useInheritedSecrets: () => input.inheritedSecrets ?? null,
      useTrialGate: () => ({ isRestricted: input.isRestricted ?? false, isWalletReady: true }),
      useTrialResourceLimit: () => input.trialResourceLimit,
      useCachedScreenedProviderCount: () => countScreenedProviders,
      useCachedNotBiddingProviderCount: () => countNotBiddingProviders,
      useServices: () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService })
    };
    const services = (input.services ?? []).map(service => ({ count: 1, ...service, profile: { storage: [], ...service.profile } }));
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm({
        defaultValues: { placements: input.placements ?? [], services },
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
      analyticsService,
      generateSdl,
      countScreenedProviders,
      countNotBiddingProviders,
      submit: () => act(() => result.current())
    };
  }
});
