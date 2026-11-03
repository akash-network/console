import type { PropsWithChildren, ReactNode } from "react";
import type { FieldErrors, FieldValues, UseFormReturn } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { ServiceType } from "@src/types";
import { resolveSdlSecrets } from "@src/utils/sdl/sdlSecrets";
import type { TrialResourceLimit } from "../ConfigurationPane/HardwareSection/trialResourceLimit/trialResourceLimit";
import type { DeploymentFlow, DeploymentFlowActions } from "../useDeploymentFlow/useDeploymentFlow";
import type { DEPENDENCIES } from "./useRequestQuotes";
import { useRequestQuotes } from "./useRequestQuotes";

import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";

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

  it("blocks a trial deployment over the trial's size cap and says what it requests and what fits the trial", async () => {
    const { requestQuotes, submit, enqueueSnackbar } = setup({
      trialResourceLimit: { maxCpu: 4, maxMemoryGi: 16 },
      services: [{ count: 1, profile: { cpu: 16, ram: 64, ramUnit: "Gi" } }]
    });

    await submit();

    expect(requestQuotes).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error", persist: true });
    render(enqueueSnackbar.mock.calls[0][0] as ReactNode);
    expect(
      screen.getByText("This deployment requests 16 vCPU and 64 GiB of memory. Free trial deployments are limited to 4 vCPU and 16 GiB of memory.")
    ).toBeInTheDocument();
  });

  describe("when the trial's size cap blocks the deployment", () => {
    const OVERSIZED = {
      trialResourceLimit: { maxCpu: 4, maxMemoryGi: 16 },
      services: [
        { count: 1, profile: { cpu: 8, ram: 8, ramUnit: "Gi" } },
        { count: 1, profile: { cpu: 0.1, ram: 512, ramUnit: "Mi" } }
      ]
    };

    it("fits the deployment to the trial in one click, so the next click requests quotes", async () => {
      const { submit, enqueueSnackbar, closeSnackbar, requestQuotes, analyticsService, formValues } = setup(OVERSIZED);
      enqueueSnackbar.mockReturnValueOnce("size-block");
      await submit();
      render(enqueueSnackbar.mock.calls[0][0] as ReactNode);

      act(() => fireEvent.click(screen.getByRole("button", { name: "Fit to free trial" })));

      expect(formValues().services.map((service: ServiceType) => service.profile)).toEqual([
        expect.objectContaining({ cpu: 3.9, ram: 8, ramUnit: "Gi" }),
        expect.objectContaining({ cpu: 0.1, ram: 512, ramUnit: "Mi" })
      ]);
      expect(closeSnackbar).toHaveBeenCalledWith("size-block");
      expect(analyticsService.track).toHaveBeenCalledWith("configure_trial_size_fitted", { category: "deployments" });
      expect(enqueueSnackbar).toHaveBeenLastCalledWith(expect.anything(), { variant: "success" });
      render(enqueueSnackbar.mock.calls[1][0] as ReactNode);
      expect(screen.getByText("This deployment now requests 4 vCPU and 8.5 GiB of memory.")).toBeInTheDocument();

      await submit();

      expect(requestQuotes).toHaveBeenCalledOnce();
    });

    it("fits the services as they are at the click, keeping edits made while the block was on screen", async () => {
      const { submit, enqueueSnackbar, formValues, setFormValue } = setup({
        trialResourceLimit: { maxCpu: 4, maxMemoryGi: 16 },
        services: [{ count: 1, profile: { cpu: 16, ram: 4, ramUnit: "Gi" } }]
      });
      await submit();
      render(enqueueSnackbar.mock.calls[0][0] as ReactNode);
      setFormValue("services.0.profile.ram", 32768);
      setFormValue("services.0.profile.ramUnit", "Mi");

      act(() => fireEvent.click(screen.getByRole("button", { name: "Fit to free trial" })));

      expect(formValues().services[0].profile).toEqual(expect.objectContaining({ cpu: 4, ram: 16, ramUnit: "Gi" }));
    });

    it("leaves services the user grew past any fit while the block was on screen as they are", async () => {
      const { submit, enqueueSnackbar, formValues, setFormValue, analyticsService } = setup({
        trialResourceLimit: { maxCpu: 1, maxMemoryGi: 16 },
        services: [{ count: 1, profile: { cpu: 2, ram: 1, ramUnit: "Gi" } }]
      });
      await submit();
      render(enqueueSnackbar.mock.calls[0][0] as ReactNode);
      setFormValue("services.0.count", 20);

      act(() => fireEvent.click(screen.getByRole("button", { name: "Fit to free trial" })));

      expect(formValues().services[0].profile).toEqual(expect.objectContaining({ cpu: 2, ram: 1, ramUnit: "Gi" }));
      expect(analyticsService.track).not.toHaveBeenCalledWith("configure_trial_size_fitted", expect.anything());
    });

    it("opens Add credits to deploy the size the user picked", async () => {
      const { submit, enqueueSnackbar, closeSnackbar, openAddCredits } = setup(OVERSIZED);
      enqueueSnackbar.mockReturnValueOnce("size-block");
      await submit();
      render(enqueueSnackbar.mock.calls[0][0] as ReactNode);

      fireEvent.click(screen.getByRole("button", { name: "Add credits" }));

      expect(openAddCredits).toHaveBeenCalledWith({
        initialTab: "purchase",
        description: "Add credits to deploy larger workloads, along with longer runtimes and the full Console.",
        context: "trial_size_limit",
        suggestFirstDeployment: false
      });
      expect(closeSnackbar).toHaveBeenCalledWith("size-block");
    });

    it("offers only Add credits when the deployment can't shrink enough to fit", async () => {
      const { submit, enqueueSnackbar } = setup({
        trialResourceLimit: { maxCpu: 1, maxMemoryGi: 16 },
        services: Array.from({ length: 11 }, () => ({ count: 1, profile: { cpu: 1, ram: 1, ramUnit: "Gi" } }))
      });
      await submit();

      render(enqueueSnackbar.mock.calls[0][0] as ReactNode);

      expect(screen.queryByRole("button", { name: "Fit to free trial" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add credits" })).toBeInTheDocument();
    });

    it("keeps offering both while the deployment is blocked for another reason too", async () => {
      const { submit, enqueueSnackbar } = setup({ ...OVERSIZED, validationErrors: ["/services/web: invalid"] });
      await submit();

      render(enqueueSnackbar.mock.calls[0][0] as ReactNode);

      expect(screen.getByText("/services/web: invalid")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Fit to free trial" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add credits" })).toBeInTheDocument();
    });
  });

  it("lets a block that offers no way past it hide on its own", async () => {
    const { submit, enqueueSnackbar } = setup({ validationErrors: ["/services/web: invalid"] });

    await submit();

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" });
    render(enqueueSnackbar.mock.calls[0][0] as ReactNode);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
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
        "This deployment requests 16 vCPU and 64 GiB of memory. Free trial deployments are limited to 4 vCPU and 16 GiB of memory."
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
    const enqueueSnackbar = vi.fn<ReturnType<typeof DEPENDENCIES.useSnackbar>["enqueueSnackbar"]>();
    const closeSnackbar = vi.fn<ReturnType<typeof DEPENDENCIES.useSnackbar>["closeSnackbar"]>();
    const openAddCredits = vi.fn<ReturnType<typeof DEPENDENCIES.useAddCredits>>();
    const analyticsService = mock<AnalyticsService>();
    const generateSdl = vi.fn(() => GENERATED_SDL);
    const countScreenedProviders = vi.fn(() => input.screenedProviderCount);
    const countNotBiddingProviders = vi.fn(() => input.notBiddingProviderCount);
    const dependencies: typeof DEPENDENCIES = {
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar, closeSnackbar }),
      useAddCredits: () => openAddCredits,
      Snackbar,
      Button,
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
    let form: UseFormReturn | undefined;
    const Wrapper = ({ children }: PropsWithChildren) => {
      form = useForm<FieldValues>({
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
      closeSnackbar,
      openAddCredits,
      formValues: () => form!.getValues(),
      setFormValue: (name: string, value: unknown) => act(() => form!.setValue(name, value)),
      analyticsService,
      generateSdl,
      countScreenedProviders,
      countNotBiddingProviders,
      submit: () => act(() => result.current())
    };
  }
});
