import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { PlacementAttributeType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultPlacement, defaultService, defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { GPU_INTERCONNECT_CAPABILITY_KEY, GPU_INTERCONNECT_FABRIC_PREFIX } from "@src/utils/sdl/gpuInterconnect";
import { GpuInterconnectCard } from "./GpuInterconnectCard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(GpuInterconnectCard.name, () => {
  it("hides the body and leaves the switch off when the service does not opt in", () => {
    setup({});

    expect(screen.getByRole("switch", { name: "Enable GPU interconnect" })).not.toBeChecked();
    expect(screen.queryByText(/high-bandwidth GPU-to-GPU interconnect/i)).not.toBeInTheDocument();
  });

  it("sets the implicit auto group, enables GPU and adds the placement capability when toggled on", async () => {
    const { getValues } = setup({ profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU interconnect" }));

    const service = getValues().services[0];
    expect(service.profile.interconnect).toEqual({});
    expect(service.profile.hasGpu).toBe(true);
    expect(service.profile.gpu).toBeGreaterThanOrEqual(1);
    expect((service.profile.gpuModels ?? []).length).toBeGreaterThanOrEqual(1);
    expect(getValues().placements[0].attributes).toEqual([{ id: expect.any(String), key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }]);
  });

  it("preserves an already-configured GPU instead of resetting it when toggled on", async () => {
    const { getValues } = setup({ profile: { hasGpu: true, gpu: 4, gpuModels: [{ vendor: "nvidia", name: "h100" }] } });

    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU interconnect" }));

    expect(getValues().services[0].profile.gpu).toBe(4);
    expect(getValues().services[0].profile.gpuModels).toEqual([{ vendor: "nvidia", name: "h100" }]);
  });

  it("normalizes an imported false capability to true instead of appending a duplicate", async () => {
    const { getValues } = setup({ attributes: [{ id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "false" }] });

    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU interconnect" }));

    expect(getValues().placements[0].attributes).toEqual([{ id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }]);
  });

  it("renders enabled for an imported implicit group", () => {
    setup({ interconnect: {} });

    expect(screen.getByRole("switch", { name: "Enable GPU interconnect" })).toBeChecked();
  });

  it("renders enabled for an imported explicit group", () => {
    setup({ interconnect: { group: "pair0" } });

    expect(screen.getByRole("switch", { name: "Enable GPU interconnect" })).toBeChecked();
    expect(screen.getByText(/high-bandwidth GPU-to-GPU interconnect/i)).toBeInTheDocument();
  });

  it("clears the opt-in and removes the capability and fabric pins when toggled off", async () => {
    const { getValues } = setup({
      interconnect: {},
      attributes: [
        { id: "r1", key: "region", value: "us-west" },
        { id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" },
        { id: "f1", key: `${GPU_INTERCONNECT_FABRIC_PREFIX}infiniband`, value: "true" }
      ]
    });

    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU interconnect" }));

    expect(getValues().services[0].profile.interconnect).toBeUndefined();
    expect(getValues().placements[0].attributes).toEqual([{ id: "r1", key: "region", value: "us-west" }]);
  });

  it("keeps the placement capability when a same-placement sibling still opts in", async () => {
    const { getValues } = setup({
      interconnect: {},
      attributes: [{ id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }],
      sibling: "same-placement"
    });

    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU interconnect" }));

    expect(getValues().services[0].profile.interconnect).toBeUndefined();
    expect(getValues().placements[0].attributes).toEqual([{ id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }]);
  });

  it("removes the placement capability when the only other opted-in service is on a different placement", async () => {
    const { getValues } = setup({
      interconnect: {},
      attributes: [{ id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }],
      sibling: "other-placement"
    });

    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU interconnect" }));

    expect(getValues().placements[0].attributes).toEqual([]);
  });

  it("shows the multi-node hint for a single-replica service", () => {
    setup({ interconnect: {}, count: 1 });

    expect(screen.getByText(/2\+ nodes/)).toBeInTheDocument();
  });

  it("leaves the replica count untouched when toggled on", async () => {
    const { getValues } = setup({ count: 1 });

    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU interconnect" }));

    expect(getValues().services[0].count).toBe(1);
  });

  it("hides the multi-node hint at two or more replicas", () => {
    setup({ interconnect: {}, count: 2 });

    expect(screen.queryByText(/2\+ nodes/)).not.toBeInTheDocument();
  });

  it("hides the multi-node hint when a same-placement sibling participates", () => {
    setup({ interconnect: {}, count: 1, sibling: "same-placement" });

    expect(screen.queryByText(/2\+ nodes/)).not.toBeInTheDocument();
  });

  it("warns when enabled while the service has no GPU resources", () => {
    setup({ interconnect: {}, profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    expect(screen.getByText(/needs GPU resources/i)).toBeInTheDocument();
  });

  it("does not warn right after enabling turns the GPU on", async () => {
    setup({ profile: { hasGpu: false, gpu: 0, gpuModels: [] } });

    await userEvent.click(screen.getByRole("switch", { name: "Enable GPU interconnect" }));

    expect(screen.queryByText(/needs GPU resources/i)).not.toBeInTheDocument();
  });

  it("disables the switch while the pane is locked", () => {
    setup({ interconnect: {}, locked: true });

    expect(screen.getByRole("switch", { name: "Enable GPU interconnect" })).toBeDisabled();
  });

  it("shows an off-state hint when opened while off and locked", async () => {
    setup({ locked: true });

    await userEvent.click(screen.getByRole("button", { name: "Expand GPU Interconnect" }));

    expect(screen.getByText("GPU interconnect is off.")).toBeInTheDocument();
  });

  it("disables the switch for a trial-blocked wallet while off", () => {
    setup({ isTrialBlocked: true });

    expect(screen.getByRole("switch", { name: "Enable GPU interconnect" })).toBeDisabled();
  });

  it("shows the trial warning with an unlock CTA that opens the add-credits sheet", async () => {
    const onUnlock = vi.fn();
    setup({ isTrialBlocked: true, onUnlock });

    await userEvent.click(screen.getByRole("button", { name: "Expand GPU Interconnect" }));
    expect(screen.getByText(/isn't available on a free trial/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /unlock gpu interconnect/i }));

    expect(onUnlock).toHaveBeenCalled();
  });

  it("keeps the switch usable for an imported interconnect so a trial-blocked wallet can turn it off", async () => {
    const { getValues } = setup({
      isTrialBlocked: true,
      interconnect: {},
      attributes: [{ id: "c1", key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }]
    });

    const interconnectSwitch = screen.getByRole("switch", { name: "Enable GPU interconnect" });
    expect(interconnectSwitch).toBeEnabled();

    await userEvent.click(interconnectSwitch);

    expect(getValues().services[0].profile.interconnect).toBeUndefined();
    expect(getValues().placements[0].attributes).toEqual([]);
  });

  it("warns that an imported interconnect would be rejected for a trial-blocked wallet", () => {
    setup({ isTrialBlocked: true, interconnect: {} });

    expect(screen.getByText(/would be rejected/i)).toBeInTheDocument();
  });

  it("does not show the trial warning when the wallet is not blocked", () => {
    setup({ interconnect: {} });

    expect(screen.queryByText(/free trial/i)).not.toBeInTheDocument();
  });

  function setup(input: {
    interconnect?: { group?: string };
    profile?: Partial<ServiceType["profile"]>;
    count?: number;
    attributes?: PlacementAttributeType[];
    sibling?: "same-placement" | "other-placement";
    locked?: boolean;
    isTrialBlocked?: boolean;
    onUnlock?: () => void;
  }) {
    const base = defaultServiceWithPlacement();
    const placements: SdlBuilderFormValuesType["placements"] = [{ ...base.placements[0], attributes: input.attributes ?? [] }];
    const services: SdlBuilderFormValuesType["services"] = [
      {
        ...base.services[0],
        count: input.count ?? base.services[0].count,
        profile: { ...base.services[0].profile, ...input.profile, interconnect: input.interconnect }
      }
    ];

    if (input.sibling) {
      const siblingPlacement = input.sibling === "same-placement" ? placements[0] : defaultPlacement({ name: "dcloud-2" });
      if (input.sibling === "other-placement") placements.push(siblingPlacement);
      services.push(defaultService(siblingPlacement.id, { title: "service-2", profile: { ...base.services[0].profile, interconnect: {} } }));
    }

    const values: SdlBuilderFormValuesType = { placements, services, endpoints: [] };

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange" });
      getValues = form.getValues;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <TooltipProvider>
          <GpuInterconnectCard serviceIndex={0} locked={input.locked} isTrialBlocked={input.isTrialBlocked} onUnlock={input.onUnlock} />
        </TooltipProvider>
      </Wrapper>
    );

    return { getValues: () => getValues() };
  }
});
