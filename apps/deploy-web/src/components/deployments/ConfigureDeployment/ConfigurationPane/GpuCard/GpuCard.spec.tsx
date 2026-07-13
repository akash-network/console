import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";
import { validationConfig } from "@src/utils/akash/units";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, GpuCard } from "./GpuCard";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const GPU_VENDORS: GpuVendor[] = [
  {
    name: "nvidia",
    models: [
      { name: "a100", memory: ["40Gi", "80Gi"], interface: ["pcie", "sxm"] },
      { name: "t4", memory: ["16Gi"], interface: ["pcie"] }
    ]
  },
  { name: "amd", models: [{ name: "mi300", memory: ["192Gi"], interface: ["pcie"] }] }
];

describe(GpuCard.name, () => {
  it("hides the body while GPU is disabled", () => {
    setup({ hasGpu: false });

    expect(screen.getByRole("switch", { name: "Enable GPU" })).not.toBeChecked();
    expect(screen.queryByLabelText("GPU vendor")).not.toBeInTheDocument();
  });

  it("enables hasGpu and defaults the count to one when toggled on", async () => {
    const { getValues, user } = setup({ hasGpu: false, gpu: 0 });

    await user.click(screen.getByRole("switch", { name: "Enable GPU" }));

    expect(getValues().services[0].profile.hasGpu).toBe(true);
    expect(getValues().services[0].profile.gpu).toBe(1);
    expect(screen.getByLabelText("GPU vendor")).toBeInTheDocument();
  });

  it("disables hasGpu and resets the count to zero when toggled off", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpu: 2 });

    await user.click(screen.getByRole("switch", { name: "Enable GPU" }));

    expect(getValues().services[0].profile.hasGpu).toBe(false);
    expect(getValues().services[0].profile.gpu).toBe(0);
  });

  it("increments the GPU count", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpu: 1 });

    await user.click(screen.getByRole("button", { name: "Increase GPU count" }));

    expect(getValues().services[0].profile.gpu).toBe(2);
  });

  it("associates GPU count errors with the quantity selector", () => {
    setup({ hasGpu: true, gpuError: "GPU count is too high." });

    const error = screen.getByText("GPU count is too high.");
    expect(screen.getByLabelText("GPU count")).toHaveAttribute("aria-describedby", error.id);
  });

  it("removes a non-first collection", async () => {
    const { getValues, user } = setup({
      hasGpu: true,
      gpuModels: [
        { vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" },
        { vendor: "amd", name: "mi300", memory: "192Gi", interface: "pcie" }
      ]
    });

    await user.click(screen.getByRole("button", { name: "Remove GPU 2" }));

    const gpuModels = getValues().services[0].profile.gpuModels;
    expect(gpuModels).toHaveLength(1);
    expect(gpuModels?.[0]).toMatchObject({ vendor: "nvidia", name: "a100" });
  });

  it("renders each collection's selects bound to its own entry", () => {
    setup({
      hasGpu: true,
      gpuModels: [
        { vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" },
        { vendor: "amd", name: "mi300", memory: "192Gi", interface: "pcie" }
      ]
    });

    const first = screen.getByRole("group", { name: "GPU 1" });
    const second = screen.getByRole("group", { name: "GPU 2" });
    expect(within(first).getByRole("combobox", { name: "GPU model" })).toHaveTextContent("a100");
    expect(within(second).getByRole("combobox", { name: "GPU model" })).toHaveTextContent("mi300");
  });

  it("disables Add GPU once the collection count reaches the max", () => {
    setup({ hasGpu: true, gpuModels: makeGpuModels(validationConfig.maxGpuAmount), dependencies: { GpuModelFields: StubGpuModelFields } });

    expect(screen.getByRole("button", { name: "Add GPU" })).toBeDisabled();
  });

  it("writes the picked model and preselects its sole memory and interface", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "t4" }));

    expect(getValues().services[0].profile.gpuModels?.[0]).toMatchObject({ vendor: "nvidia", name: "t4", memory: "16Gi", interface: "pcie" });
  });

  it("does not preselect memory or interface when the model offers several options", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "a100" }));

    expect(getValues().services[0].profile.gpuModels?.[0]).toMatchObject({ memory: "", interface: "" });
  });

  it("resets model, memory, and interface when the vendor changes", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" }] });

    await user.click(screen.getByRole("combobox", { name: "GPU vendor" }));
    await user.click(await screen.findByRole("option", { name: "amd" }));

    expect(getValues().services[0].profile.gpuModels?.[0]).toEqual({ vendor: "amd", name: "", memory: "", interface: "" });
  });

  it("clears the model along with memory and interface", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" }] });

    await user.click(screen.getByRole("button", { name: "Clear GPU model" }));

    expect(getValues().services[0].profile.gpuModels?.[0]).toMatchObject({ vendor: "nvidia", name: "", memory: "", interface: "" });
  });

  it("resets the model select's displayed value when the model is cleared", async () => {
    const { user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" }] });

    expect(screen.getByRole("combobox", { name: "GPU model" })).toHaveTextContent("a100");

    await user.click(screen.getByRole("button", { name: "Clear GPU model" }));

    expect(screen.getByRole("combobox", { name: "GPU model" })).not.toHaveTextContent("a100");
  });

  it("clears only the memory when the memory clear button is clicked", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" }] });

    await user.click(screen.getByRole("button", { name: "Clear GPU memory" }));

    expect(getValues().services[0].profile.gpuModels?.[0]).toMatchObject({ name: "a100", memory: "", interface: "pcie" });
  });

  it("clears only the interface when the interface clear button is clicked", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" }] });

    await user.click(screen.getByRole("button", { name: "Clear GPU interface" }));

    expect(getValues().services[0].profile.gpuModels?.[0]).toMatchObject({ name: "a100", memory: "40Gi", interface: "" });
  });

  it("does not offer clear buttons while the fields are empty", () => {
    setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });

    expect(screen.queryByRole("button", { name: "Clear GPU model" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear GPU memory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear GPU interface" })).not.toBeInTheDocument();
  });

  it("appends a GPU collection when Add GPU is clicked", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });

    await user.click(screen.getByRole("button", { name: "Add GPU" }));

    expect(await screen.findByRole("group", { name: "GPU 2" })).toBeInTheDocument();
    expect(getValues().services[0].profile.gpuModels).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Remove GPU 2" })).toBeInTheDocument();
  });

  it("does not offer a remove control for the first collection", () => {
    setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });

    expect(screen.queryByRole("button", { name: "Remove GPU 1" })).not.toBeInTheDocument();
  });

  it("shows a loading affordance instead of the model selects while GPU models are loading", () => {
    setup({ hasGpu: true, isLoading: true });

    expect(screen.getByText("Loading GPU models...")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "GPU model" })).not.toBeInTheDocument();
  });

  it("shows an error message instead of the model selects when GPU models fail to load", () => {
    setup({ hasGpu: true, isError: true });

    expect(screen.getByText(/failed to load gpu models/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "GPU model" })).not.toBeInTheDocument();
  });

  it("disables the enable switch and every GPU input while locked", () => {
    setup({ hasGpu: true, locked: true, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" }] });

    expect(screen.getByRole("switch", { name: "Enable GPU" })).toBeDisabled();
    expect(screen.getByLabelText("GPU count")).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "GPU vendor" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "GPU model" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "GPU memory" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "GPU interface" })).toBeDisabled();
  }, 15_000);

  const StubGpuModelFields: typeof DEPENDENCIES.GpuModelFields = ({ gpuIndex }) => <div role="group" aria-label={`GPU ${gpuIndex + 1}`} />;

  function makeGpuModels(count: number): SdlBuilderFormValuesType["services"][number]["profile"]["gpuModels"] {
    return Array.from({ length: count }, () => ({ vendor: "nvidia", name: "", memory: "", interface: "" }));
  }

  function setup(input: {
    gpu?: number;
    hasGpu?: boolean;
    gpuModels?: SdlBuilderFormValuesType["services"][number]["profile"]["gpuModels"];
    gpuError?: string;
    isLoading?: boolean;
    isError?: boolean;
    locked?: boolean;
    dependencies?: Partial<typeof DEPENDENCIES>;
  }) {
    const values = defaultServiceWithPlacement({
      profile: {
        cpu: 0.5,
        gpu: input.gpu ?? (input.hasGpu ? 1 : 0),
        gpuModels: input.gpuModels ?? [{ vendor: "nvidia", name: "", memory: "", interface: "" }],
        hasGpu: input.hasGpu ?? false,
        ram: 256,
        ramUnit: "Mi",
        storage: [{ size: 1, unit: "Gi", isPersistent: false, type: "beta2" }]
      }
    });

    const gpuModelsResult = mock<ReturnType<typeof DEPENDENCIES.useGpuModels>>({
      data: input.isLoading || input.isError ? undefined : GPU_VENDORS,
      isLoading: input.isLoading ?? false,
      isError: input.isError ?? false
    } as Partial<ReturnType<typeof DEPENDENCIES.useGpuModels>>);
    const useGpuModels: typeof DEPENDENCIES.useGpuModels = () => gpuModelsResult;
    const useFieldError: typeof DEPENDENCIES.useFieldError = () => ({ error: input.gpuError });

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange" });
      getValues = form.getValues;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <GpuCard serviceIndex={0} locked={input.locked} dependencies={{ ...DEPENDENCIES, useGpuModels, useFieldError, ...input.dependencies }} />
      </Wrapper>
    );

    const user = userEvent.setup();

    return { user, getValues: () => getValues() };
  }
});
