import type { PropsWithChildren } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AvailableGpuVendor } from "@src/queries/usePlacementOptions";
import type { ScreenedProviderCount } from "@src/queries/useScreenedProviders";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";
import { validationConfig } from "@src/utils/akash/units";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { DEPENDENCIES, GpuCard } from "./GpuCard";

import { act, render, screen, within } from "@testing-library/react";
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
  it("reads None in the header and counts zero GPUs while the GPU is off", () => {
    setup({ hasGpu: false, gpu: 1 });

    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getByLabelText("GPUs")).toHaveValue(0);
    expect(screen.queryByRole("switch", { name: "Enable GPU" })).not.toBeInTheDocument();
  });

  it("reads the count and the model in the header while expanded", () => {
    setup({ hasGpu: true, gpu: 2, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "", interface: "" }] });

    expect(screen.getByText("2× A100")).toBeInTheDocument();
  });

  it("turns the GPU on with one unit and a default model when counting up from zero", async () => {
    const { getValues, user } = setup({ hasGpu: false, gpu: 1, gpuModels: [] });

    await user.click(screen.getByRole("button", { name: "Increase GPUs" }));

    expect(getValues().services[0].profile).toMatchObject({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });
  });

  it("turns the GPU off at zero and keeps the picked model", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "", interface: "" }] });

    await user.click(screen.getByRole("button", { name: "Decrease GPUs" }));

    expect(getValues().services[0].profile).toMatchObject({ hasGpu: false, gpu: 0, gpuModels: [{ vendor: "nvidia", name: "a100" }] });
    expect(screen.getByText("None")).toBeInTheDocument();
  });

  it("writes the first model and turns the GPU on when a model is picked before any entry exists", async () => {
    const { getValues, user } = setup({ hasGpu: false, gpu: 0, gpuModels: [] });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "NVIDIA a100" }));

    expect(getValues().services[0].profile).toMatchObject({
      hasGpu: true,
      gpu: 1,
      gpuModels: [{ vendor: "nvidia", name: "a100", memory: "", interface: "" }]
    });
  });

  it("turns the GPU on when a model is picked while it is off", async () => {
    const { getValues, user } = setup({ hasGpu: false, gpu: 0, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "NVIDIA t4" }));

    expect(getValues().services[0].profile).toMatchObject({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "t4" }] });
  });

  it("turns the GPU on when the model it already has is picked again while it is off", async () => {
    const { getValues, user } = setup({ hasGpu: false, gpu: 0, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "Any GPU" }));

    expect(getValues().services[0].profile).toMatchObject({ hasGpu: true, gpu: 1 });
  });

  it("keeps the vendor, memory and interface pickers out of the way while the GPU is off", () => {
    setup({ hasGpu: false, gpu: 0, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "", interface: "" }] });

    expect(screen.getByRole("combobox", { name: "GPU model" })).toHaveTextContent("a100");
    expect(screen.queryByRole("combobox", { name: "GPU vendor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "GPU memory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "GPU interface" })).not.toBeInTheDocument();
  });

  it.each([
    { case: "before any entry exists", gpuModels: [] },
    { case: "with an entry left on any model", gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] }
  ])("prompts for a model while the GPU is off $case", ({ gpuModels }) => {
    setup({ hasGpu: false, gpu: 0, gpuModels });

    expect(screen.getByRole("combobox", { name: "GPU model" })).toHaveTextContent("Select");
  });

  it("names Any GPU in the trigger once the GPU is on without a pinned model", () => {
    setup({ hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });

    expect(screen.getByRole("combobox", { name: "GPU model" })).toHaveTextContent("Any GPU");
  });

  it("offers the GPU interconnect inside the card", () => {
    setup({ hasGpu: false });

    expect(screen.getByRole("switch", { name: "Enable GPU interconnect" })).not.toBeChecked();
  });

  it("increments the GPU count", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpu: 1 });

    await user.click(screen.getByRole("button", { name: "Increase GPUs" }));

    expect(getValues().services[0].profile.gpu).toBe(2);
  });

  it("associates GPU count errors with the quantity selector", () => {
    setup({ hasGpu: true, gpuError: "GPU count is too high." });

    const error = screen.getByText("GPU count is too high.");
    expect(screen.getByLabelText("GPUs")).toHaveAttribute("aria-describedby", error.id);
  });

  it("removes a non-first collection", async () => {
    const { getValues, user } = setup({
      hasGpu: true,
      gpuModels: [
        { vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" },
        { vendor: "amd", name: "mi300", memory: "192Gi", interface: "pcie" }
      ]
    });

    await user.click(screen.getByRole("button", { name: "Remove alternative model 1" }));

    const gpuModels = getValues().services[0].profile.gpuModels;
    expect(gpuModels).toHaveLength(1);
    expect(gpuModels?.[0]).toMatchObject({ vendor: "nvidia", name: "a100" });
  });

  it("removes the alternative that was asked for when there are several", async () => {
    const { getValues, user } = setup({
      hasGpu: true,
      gpuModels: [
        { vendor: "nvidia", name: "a100", memory: "", interface: "" },
        { vendor: "amd", name: "mi300", memory: "", interface: "" },
        { vendor: "nvidia", name: "t4", memory: "", interface: "" }
      ]
    });

    await user.click(screen.getByRole("button", { name: "Remove alternative model 1" }));

    expect(getValues().services[0].profile.gpuModels?.map(model => model.name)).toEqual(["a100", "t4"]);
  });

  it("renders each collection's selects bound to its own entry", () => {
    setup({
      hasGpu: true,
      gpuModels: [
        { vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" },
        { vendor: "amd", name: "mi300", memory: "192Gi", interface: "pcie" }
      ]
    });

    const [firstModel] = screen.getAllByRole("combobox", { name: "GPU model" });
    const alternative = screen.getByRole("group", { name: "Alternative model 1" });
    expect(firstModel).toHaveTextContent("a100");
    expect(within(alternative).getByRole("combobox", { name: "GPU model" })).toHaveTextContent("mi300");
  });

  it("disables Add another model once the collection count reaches the max", () => {
    setup({ hasGpu: true, gpuModels: makeGpuModels(validationConfig.maxGpuAmount), dependencies: { GpuModelFields: StubGpuModelFields } });

    expect(screen.getByRole("button", { name: "Add another model" })).toBeDisabled();
  });

  it("writes the picked model and leaves its sole memory and interface for the user to pin", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "NVIDIA t4" }));

    expect(getValues().services[0].profile.gpuModels?.[0]).toEqual({ vendor: "nvidia", name: "t4", memory: "", interface: "" });
  });

  it("drops a pinned memory and interface when another model is picked", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" }] });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "NVIDIA t4" }));

    expect(getValues().services[0].profile.gpuModels?.[0]).toEqual({ vendor: "nvidia", name: "t4", memory: "", interface: "" });
  });

  it("keeps a pinned memory and interface when the same model is picked again", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" }] });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "NVIDIA a100" }));

    expect(getValues().services[0].profile.gpuModels?.[0]).toEqual({ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" });
  });

  it("resets model, memory, and interface when the vendor changes", async () => {
    const { getValues, user } = setup({
      hasGpu: true,
      gpuModels: [{ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" }],
      availableGpus: everyCatalogGpuAvailable()
    });

    await user.click(screen.getByRole("combobox", { name: "GPU vendor" }));
    await user.click(await screen.findByRole("option", { name: "amd" }));

    expect(getValues().services[0].profile.gpuModels?.[0]).toEqual({ vendor: "amd", name: "", memory: "", interface: "" });
  });

  it("clears the model along with memory and interface when Any GPU is picked", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" }] });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "Any GPU" }));

    expect(getValues().services[0].profile.gpuModels?.[0]).toMatchObject({ vendor: "nvidia", name: "", memory: "", interface: "" });
  });

  it("resets the model select's displayed value when the model is cleared", async () => {
    const { user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" }] });

    expect(screen.getByRole("combobox", { name: "GPU model" })).toHaveTextContent("a100");

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "Any GPU" }));

    expect(screen.getByRole("combobox", { name: "GPU model" })).not.toHaveTextContent("a100");
  });

  it("orders the model options by GPU priority", async () => {
    const { user } = setup({
      hasGpu: true,
      gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }],
      vendors: [
        {
          name: "nvidia",
          models: [
            { name: "t4", memory: ["16Gi"], interface: ["pcie"] },
            { name: "a100", memory: ["80Gi"], interface: ["sxm"] },
            { name: "h100", memory: ["80Gi"], interface: ["sxm"] }
          ]
        }
      ]
    });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));

    const optionNames = (await screen.findAllByRole("option")).map(option => option.textContent);
    expect(optionNames).toEqual(["Any GPU", "NVIDIA h100", "NVIDIA a100", "NVIDIA t4"]);
  });

  it("filters the model options by the search box", async () => {
    const { user } = setup({
      hasGpu: true,
      gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }],
      vendors: [
        {
          name: "nvidia",
          models: [
            { name: "h100", memory: ["80Gi"], interface: ["sxm"] },
            { name: "t4", memory: ["16Gi"], interface: ["pcie"] }
          ]
        }
      ]
    });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.type(await screen.findByRole("combobox", { name: "Search GPU models" }), "h1");

    expect(screen.getByRole("option", { name: "NVIDIA h100" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "NVIDIA t4" })).not.toBeInTheDocument();
  });

  it("shows the prettified model displayName in the options and trigger while writing the raw name", async () => {
    const { getValues, user } = setup({
      hasGpu: true,
      gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }],
      vendors: [{ name: "nvidia", displayName: "NVIDIA", models: [{ name: "rtx4090", displayName: "RTX 4090", memory: ["24Gi"], interface: ["pcie"] }] }]
    });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "NVIDIA RTX 4090" }));

    expect(screen.getByRole("combobox", { name: "GPU model" })).toHaveTextContent("RTX 4090");
    expect(getValues().services[0].profile.gpuModels?.[0]).toMatchObject({ name: "rtx4090" });
  });

  it("matches the prettified model name in the search box in addition to the raw name", async () => {
    const { user } = setup({
      hasGpu: true,
      gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }],
      vendors: [
        {
          name: "nvidia",
          displayName: "NVIDIA",
          models: [
            { name: "rtx4090", displayName: "RTX 4090", memory: ["24Gi"], interface: ["pcie"] },
            { name: "a100", displayName: "A100", memory: ["80Gi"], interface: ["sxm"] }
          ]
        }
      ]
    });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.type(await screen.findByRole("combobox", { name: "Search GPU models" }), "RTX 40");

    expect(screen.getByRole("option", { name: "NVIDIA RTX 4090" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "NVIDIA A100" })).not.toBeInTheDocument();
  });

  it("labels the vendor option with its displayName", async () => {
    const { user } = setup({
      hasGpu: true,
      vendors: [
        { name: "nvidia", displayName: "NVIDIA", models: [{ name: "a100", displayName: "A100", memory: ["80Gi"], interface: ["sxm"] }] },
        { name: "amd", displayName: "AMD", models: [{ name: "mi300", memory: ["192Gi"], interface: ["pcie"] }] }
      ],
      availableGpus: everyCatalogGpuAvailable()
    });

    await user.click(screen.getByRole("combobox", { name: "GPU vendor" }));

    expect(await screen.findByRole("option", { name: "NVIDIA" })).toBeInTheDocument();
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

    expect(screen.queryByRole("button", { name: "Clear GPU memory" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear GPU interface" })).not.toBeInTheDocument();
  });

  it("appends an alternative model when Add another model is clicked", async () => {
    const { getValues, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });

    await user.click(screen.getByRole("button", { name: "Add another model" }));

    expect(await screen.findByRole("group", { name: "Alternative model 1" })).toBeInTheDocument();
    expect(getValues().services[0].profile.gpuModels).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Remove alternative model 1" })).toBeInTheDocument();
  });

  it("does not offer a remove control for the first model", () => {
    setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });

    expect(screen.queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it("keeps alternative models and the add control hidden while the GPU is off", () => {
    setup({
      hasGpu: false,
      gpu: 0,
      gpuModels: [
        { vendor: "nvidia", name: "a100", memory: "", interface: "" },
        { vendor: "nvidia", name: "t4", memory: "", interface: "" }
      ]
    });

    expect(screen.queryByRole("group", { name: "Alternative model 1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add another model" })).not.toBeInTheDocument();
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

  it("disables every GPU input while locked", () => {
    setup({
      hasGpu: true,
      locked: true,
      gpuModels: [{ vendor: "nvidia", name: "a100", memory: "40Gi", interface: "pcie" }],
      availableGpus: everyCatalogGpuAvailable()
    });

    expect(screen.getByLabelText("GPUs")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Enable GPU interconnect" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "GPU vendor" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "GPU model" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "GPU memory" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "GPU interface" })).toBeDisabled();
  }, 15_000);

  it("tracks the selected GPU model with its vendor", async () => {
    const { analyticsService, user } = setup({ hasGpu: true, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] });

    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "NVIDIA t4" }));

    expect(analyticsService.track).toHaveBeenCalledWith("configure_gpu_type_selected", { category: "deployments", model: "t4", vendor: "nvidia" });
  });

  it("tracks the model with the vendor the entry switched to", async () => {
    const { analyticsService, user } = setup({
      hasGpu: true,
      gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }],
      availableGpus: everyCatalogGpuAvailable()
    });

    await user.click(screen.getByRole("combobox", { name: "GPU vendor" }));
    await user.click(await screen.findByRole("option", { name: "amd" }));
    await user.click(screen.getByRole("combobox", { name: "GPU model" }));
    await user.click(await screen.findByRole("option", { name: "AMD mi300" }));

    expect(analyticsService.track).toHaveBeenCalledWith("configure_gpu_type_selected", { category: "deployments", model: "mi300", vendor: "amd" });
  });

  it("tracks a GPU count change", async () => {
    const { analyticsService, user } = setup({ hasGpu: true, gpu: 1 });

    await user.click(screen.getByRole("button", { name: "Increase GPUs" }));

    expect(analyticsService.track).toHaveBeenCalledWith("configure_gpu_count_changed", { category: "deployments", count: 2 });
  });

  describe("availability", () => {
    it("offers the models an online provider has free capacity for and lists the rest of the catalog as unavailable", async () => {
      const { user } = setup({ hasGpu: true, availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"])] }] });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      const unavailable = within(await screen.findByRole("group", { name: "Others" }));

      expect(screen.getByRole("option", { name: "NVIDIA t4" })).toHaveAttribute("aria-disabled", "false");
      expect(unavailable.getByRole("option", { name: "NVIDIA a100" })).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("option", { name: "Any GPU" })).toBeInTheDocument();
    });

    it("counts the providers that could host this configuration with each offered model rather than every provider with one free", async () => {
      const { user } = setup({
        hasGpu: true,
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"], 4, 40), availableModel("a100", ["80Gi"], ["sxm"], 2, 17)] }],
        screened: { t4: { count: 3, gpuCount: 30 }, a100: { count: 1, gpuCount: 14 } }
      });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));

      expect(await screen.findByRole("option", { name: "NVIDIA t4" })).toHaveAccessibleDescription("30 free GPUs on 3 providers");
      expect(screen.getByRole("option", { name: "NVIDIA a100" })).toHaveAccessibleDescription("14 free GPUs on 1 provider");
    });

    it("screens this service switched to each offered model, and only once the picker opens", async () => {
      const { user, useScreenedGpuModelCount } = setup({
        hasGpu: true,
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"]), availableModel("a100", ["80Gi"], ["sxm"])] }]
      });
      expect(useScreenedGpuModelCount).not.toHaveBeenCalled();

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      await screen.findByRole("option", { name: "NVIDIA t4" });

      expect(useScreenedGpuModelCount).toHaveBeenCalledWith(0, { vendor: "nvidia", name: "t4" });
      expect(useScreenedGpuModelCount).toHaveBeenCalledWith(0, { vendor: "nvidia", name: "a100" });
    });

    it("marks a model as being checked until its screening answers", async () => {
      const { user } = setup({
        hasGpu: true,
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"])] }],
        screened: { t4: { count: null, gpuCount: null, isLoading: true } }
      });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));

      expect(await screen.findByRole("option", { name: "NVIDIA t4" })).toHaveAccessibleDescription("Checking");
    });

    it("lists the offered models under an Available heading with their bare provider and free gpu counts", async () => {
      const { user } = setup({ hasGpu: true, availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"], 4, 40)] }] });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      const available = within(await screen.findByRole("group", { name: "Available" }));
      const offered = within(available.getByRole("option", { name: "NVIDIA t4" }));

      expect(offered.getByText("4")).toBeInTheDocument();
      expect(offered.getByText("40")).toBeInTheDocument();
      expect(within(screen.getByRole("listbox")).getByText("Providers")).toBeInTheDocument();
      expect(within(screen.getByRole("listbox")).getByText("GPUs")).toBeInTheDocument();
    });

    it("counts no provider and no free gpu on an unavailable model", async () => {
      const { user } = setup({ hasGpu: true, availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"])] }] });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));

      expect(await screen.findByRole("option", { name: "NVIDIA a100" })).toHaveAccessibleDescription("0 free GPUs on 0 providers");
    });

    it("shows the provider count alone while screening does not count free gpus", async () => {
      const { user } = setup({
        hasGpu: true,
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"], 4)] }],
        screened: { t4: { count: 4, gpuCount: null } }
      });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      const offered = await screen.findByRole("option", { name: "NVIDIA t4" });

      expect(offered).toHaveAccessibleDescription("4 providers");
      expect(within(offered).getByText("–")).toBeInTheDocument();
    });

    it("lists every model under an All models heading without provider counts when availability cannot be loaded", async () => {
      const { user } = setup({ hasGpu: true });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      const allModels = within(await screen.findByRole("group", { name: "All models" }));

      expect(allModels.getByRole("option", { name: "NVIDIA t4" })).not.toHaveAttribute("aria-describedby");
      expect(screen.queryByRole("group", { name: "Available" })).not.toBeInTheDocument();
      expect(screen.queryByText("Providers")).not.toBeInTheDocument();
    });

    it("finds the models by their vendor name", async () => {
      const { user } = setup({ hasGpu: true, availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"])] }] });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      await user.type(await screen.findByRole("combobox", { name: "Search GPU models" }), "nvidia");

      expect(screen.getByRole("option", { name: "NVIDIA t4" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "NVIDIA a100" })).toBeInTheDocument();
    });

    it("asks for the searched gpu in the hardware request dialog, with this service's configuration", async () => {
      const { user, HardwareRequestDialog } = setup({
        hasGpu: true,
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"])] }]
      });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      await user.type(await screen.findByRole("combobox", { name: "Search GPU models" }), " b300 ");
      await user.click(screen.getByRole("button", { name: /contact us/i }));

      expect(screen.getByText("Hardware request dialog")).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "Search GPU models" })).not.toBeInTheDocument();
      expect(HardwareRequestDialog).toHaveBeenLastCalledWith(
        expect.objectContaining({
          initialGpuModel: "b300",
          configuration: expect.objectContaining({ summary: "0.5 vCPU · 1× Any GPU · 256 MiB memory · 1 GiB storage · Any region" })
        }),
        expect.anything()
      );
    });

    it("opens the hardware request dialog with no gpu before anything is searched", async () => {
      const { user, HardwareRequestDialog } = setup({
        hasGpu: true,
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"])] }]
      });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      await user.click(await screen.findByRole("button", { name: /contact us/i }));

      expect(HardwareRequestDialog).toHaveBeenLastCalledWith(expect.objectContaining({ initialGpuModel: "" }), expect.anything());
    });

    it("offers the hardware request dialog from the first model picker of a service without a gpu entry", async () => {
      const { user } = setup({ gpuModels: [] });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      await user.click(await screen.findByRole("button", { name: /contact us/i }));

      expect(screen.getByText("Hardware request dialog")).toBeInTheDocument();
    });

    it("closes the hardware request dialog when it asks to", async () => {
      const { user, HardwareRequestDialog } = setup({ hasGpu: true });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      await user.click(await screen.findByRole("button", { name: /contact us/i }));
      act(() => HardwareRequestDialog.mock.lastCall![0].onClose());

      expect(screen.queryByText("Hardware request dialog")).not.toBeInTheDocument();
    });

    it("keeps the counts on a model once it is picked", async () => {
      const { user } = setup({ hasGpu: true, availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"], 4, 12)] }] });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      await user.click(await screen.findByRole("option", { name: "NVIDIA t4" }));
      await user.click(screen.getByRole("combobox", { name: "GPU model" }));

      expect(await screen.findByRole("option", { name: "NVIDIA t4" })).toHaveAccessibleDescription("12 free GPUs on 4 providers");
    });

    it("finds an unavailable model with the search box", async () => {
      const { user } = setup({ hasGpu: true, availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"])] }] });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      await user.type(await screen.findByRole("combobox", { name: "Search GPU models" }), "a1");

      expect(screen.getByRole("option", { name: "NVIDIA a100" })).toHaveAttribute("aria-disabled", "true");
      expect(screen.queryByText("No models found.")).not.toBeInTheDocument();
    });

    it("finds an unavailable model by its display name", async () => {
      const { user } = setup({
        hasGpu: true,
        vendors: [
          {
            name: "nvidia",
            models: [
              { name: "rtx4090", displayName: "RTX 4090", memory: ["24Gi"], interface: ["pcie"] },
              { name: "t4", displayName: "T4", memory: ["16Gi"], interface: ["pcie"] }
            ]
          }
        ],
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"])] }]
      });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      await user.type(await screen.findByRole("combobox", { name: "Search GPU models" }), "RTX 40");

      expect(screen.getByRole("option", { name: "NVIDIA RTX 4090" })).toHaveAttribute("aria-disabled", "true");
    });

    it("lists the offered and unavailable models of the vendor the entry switches to", async () => {
      const { user } = setup({
        hasGpu: true,
        availableGpus: [
          { vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"])] },
          { vendor: "amd", models: [availableModel("mi300", ["192Gi"], ["pcie"], 2)] }
        ]
      });

      await user.click(screen.getByRole("combobox", { name: "GPU vendor" }));
      await user.click(await screen.findByRole("option", { name: "amd" }));
      await user.click(screen.getByRole("combobox", { name: "GPU model" }));

      expect(await screen.findByRole("option", { name: "AMD mi300" })).toHaveAccessibleDescription("2 free GPUs on 2 providers");
      expect(screen.queryByRole("option", { name: "NVIDIA t4" })).not.toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Others" })).not.toBeInTheDocument();
    });

    it("disables the model picker while the vendor has no model to list", () => {
      setup({
        hasGpu: true,
        gpuModels: [{ vendor: "intel", name: "", memory: "", interface: "" }],
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4")] }]
      });

      expect(screen.getByRole("combobox", { name: "GPU model" })).toBeDisabled();
    });

    it("lists a pinned model nobody offers as unavailable while the card still shows it", async () => {
      const { user } = setup({
        hasGpu: true,
        gpuModels: [{ vendor: "nvidia", name: "a100", memory: "80Gi", interface: "sxm" }],
        vendors: [
          {
            name: "nvidia",
            models: [
              { name: "a100", displayName: "A100", memory: ["40Gi", "80Gi"], interface: ["pcie", "sxm"] },
              { name: "t4", displayName: "T4", memory: ["16Gi"], interface: ["pcie"] }
            ]
          }
        ],
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"])] }]
      });

      expect(screen.getByRole("combobox", { name: "GPU model" })).toHaveTextContent("A100");
      expect(screen.getByRole("combobox", { name: "GPU memory" })).toHaveTextContent("80Gi");
      expect(screen.getByRole("combobox", { name: "GPU interface" })).toHaveTextContent("sxm");

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));
      const unavailable = within(await screen.findByRole("group", { name: "Others" }));

      expect(unavailable.getByRole("option", { name: "NVIDIA A100" })).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("option", { name: "NVIDIA T4" })).toHaveAttribute("aria-disabled", "false");
    });

    it("offers only the memory sizes and interfaces the picked model is available with", async () => {
      const { user } = setup({
        hasGpu: true,
        gpuModels: [{ vendor: "nvidia", name: "a100", memory: "", interface: "" }],
        availableGpus: [{ vendor: "nvidia", models: [availableModel("a100", ["80Gi"], ["sxm"])] }]
      });

      await user.click(screen.getByRole("combobox", { name: "GPU memory" }));
      expect(await screen.findByRole("option", { name: "80Gi" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "40Gi" })).not.toBeInTheDocument();

      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("combobox", { name: "GPU interface" }));
      expect(await screen.findByRole("option", { name: "sxm" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "pcie" })).not.toBeInTheDocument();
    });

    it("offers only the interfaces a provider advertises with the memory size just pinned", async () => {
      const { user } = setup({
        hasGpu: true,
        gpuModels: [{ vendor: "nvidia", name: "h100", memory: "", interface: "" }],
        availableGpus: [
          {
            vendor: "nvidia",
            models: [
              {
                ...availableModel("h100", ["80Gi"], ["sxm", "pcie"]),
                variants: [variant(null, null, 3), variant("80Gi", null, 3), variant(null, "sxm", 3), variant(null, "pcie", 1), variant("80Gi", "pcie", 1)]
              }
            ]
          }
        ]
      });

      await user.click(screen.getByRole("combobox", { name: "GPU memory" }));
      await user.click(await screen.findByRole("option", { name: "80Gi" }));
      await user.click(screen.getByRole("combobox", { name: "GPU interface" }));

      expect(await screen.findByRole("option", { name: "pcie" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "sxm" })).not.toBeInTheDocument();
    });

    it("offers only the memory sizes a provider advertises with the interface just pinned", async () => {
      const { user } = setup({
        hasGpu: true,
        gpuModels: [{ vendor: "nvidia", name: "a100", memory: "", interface: "" }],
        availableGpus: [
          {
            vendor: "nvidia",
            models: [
              {
                ...availableModel("a100", ["40Gi", "80Gi"], ["sxm"]),
                variants: [variant(null, null, 2), variant("40Gi", null, 1), variant("80Gi", null, 1), variant(null, "sxm", 1), variant("80Gi", "sxm", 1)]
              }
            ]
          }
        ]
      });

      await user.click(screen.getByRole("combobox", { name: "GPU interface" }));
      await user.click(await screen.findByRole("option", { name: "sxm" }));
      await user.click(screen.getByRole("combobox", { name: "GPU memory" }));

      expect(await screen.findByRole("option", { name: "80Gi" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "40Gi" })).not.toBeInTheDocument();
    });

    it("keeps showing a pinned memory size and interface that no provider advertises together", () => {
      setup({
        hasGpu: true,
        gpuModels: [{ vendor: "nvidia", name: "h100", memory: "80Gi", interface: "sxm" }],
        availableGpus: [
          {
            vendor: "nvidia",
            models: [
              {
                ...availableModel("h100", ["80Gi"], ["sxm"]),
                variants: [variant(null, null, 1), variant("80Gi", null, 1), variant(null, "sxm", 1)]
              }
            ]
          }
        ]
      });

      expect(screen.getByRole("combobox", { name: "GPU memory" })).toHaveTextContent("80Gi");
      expect(screen.getByRole("combobox", { name: "GPU interface" })).toHaveTextContent("sxm");
    });

    it("drops the vendor step while one vendor is available and still writes that vendor", () => {
      const { getValues } = setup({ hasGpu: true, availableGpus: [{ vendor: "nvidia", models: [availableModel("t4")] }] });

      expect(screen.queryByRole("combobox", { name: "GPU vendor" })).not.toBeInTheDocument();
      expect(getValues().services[0].profile.gpuModels?.[0]).toMatchObject({ vendor: "nvidia" });
    });

    it("keeps the vendor step and the pinned vendor when the configuration names an unavailable one", () => {
      const { getValues } = setup({
        hasGpu: true,
        gpuModels: [{ vendor: "amd", name: "mi300", memory: "192Gi", interface: "pcie" }],
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4")] }]
      });

      expect(screen.getByRole("combobox", { name: "GPU vendor" })).toBeInTheDocument();
      expect(getValues().services[0].profile.gpuModels?.[0]).toMatchObject({ vendor: "amd", name: "mi300" });
    });

    it("still displays a pinned vendor, model, memory and interface that are no longer available", () => {
      setup({
        hasGpu: true,
        gpuModels: [{ vendor: "amd", name: "mi300", memory: "192Gi", interface: "pcie" }],
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4")] }]
      });

      expect(screen.getByRole("combobox", { name: "GPU vendor" })).toHaveTextContent("amd");
      expect(screen.getByRole("combobox", { name: "GPU model" })).toHaveTextContent("mi300");
      expect(screen.getByRole("combobox", { name: "GPU model" })).toBeEnabled();
      expect(screen.getByRole("combobox", { name: "GPU memory" })).toHaveTextContent("192Gi");
      expect(screen.getByRole("combobox", { name: "GPU interface" })).toHaveTextContent("pcie");
    });

    it("offers the available vendors alongside a pinned one that is not available", async () => {
      const { user } = setup({
        hasGpu: true,
        gpuModels: [{ vendor: "amd", name: "mi300", memory: "192Gi", interface: "pcie" }],
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4")] }]
      });

      await user.click(screen.getByRole("combobox", { name: "GPU vendor" }));

      expect(await screen.findByRole("option", { name: "nvidia" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "amd" })).toBeInTheDocument();
    });

    it("keeps the vendor step while more than one vendor is available", () => {
      setup({
        hasGpu: true,
        availableGpus: [
          { vendor: "nvidia", models: [availableModel("t4")] },
          { vendor: "amd", models: [availableModel("mi300")] }
        ]
      });

      expect(screen.getByRole("combobox", { name: "GPU vendor" })).toBeInTheDocument();
    });

    it("offers the whole catalog when availability cannot be loaded", async () => {
      const { user } = setup({ hasGpu: true });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));

      expect(await screen.findByRole("option", { name: "NVIDIA a100" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "NVIDIA t4" })).toBeInTheDocument();
      expect(screen.queryByRole("group", { name: "Others" })).not.toBeInTheDocument();
    });

    it("drops the vendor step when availability cannot be loaded", () => {
      setup({ hasGpu: true });

      expect(screen.queryByRole("combobox", { name: "GPU vendor" })).not.toBeInTheDocument();
    });

    it("offers only the default vendor and a pinned one when availability cannot be loaded", async () => {
      const { user } = setup({
        hasGpu: true,
        gpuModels: [{ vendor: "amd", name: "mi300", memory: "", interface: "" }],
        vendors: [...GPU_VENDORS, { name: "intel", models: [{ name: "max1550", memory: ["128Gi"], interface: ["pcie"] }] }]
      });

      await user.click(screen.getByRole("combobox", { name: "GPU vendor" }));

      expect((await screen.findAllByRole("option")).map(option => option.textContent)).toEqual(["nvidia", "amd"]);
    });

    it("still sorts the popular models to the top of the shortened list", async () => {
      const { user } = setup({
        hasGpu: true,
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4"), availableModel("h100"), availableModel("a100")] }]
      });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));

      expect(await screen.findAllByRole("option")).toEqual(
        ["Any GPU", "NVIDIA h100", "NVIDIA a100", "NVIDIA t4"].map(name => screen.getByRole("option", { name }))
      );
    });

    it("adds and removes GPU entries without a vendor step", async () => {
      const { getValues, user } = setup({ hasGpu: true, availableGpus: [{ vendor: "nvidia", models: [availableModel("t4")] }] });

      await user.click(screen.getByRole("button", { name: "Add another model" }));

      expect(getValues().services[0].profile.gpuModels).toHaveLength(2);
      expect(screen.queryByRole("combobox", { name: "GPU vendor" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Remove alternative model 1" }));

      expect(getValues().services[0].profile.gpuModels).toHaveLength(1);
    });

    it("offers the available models when only the hardware catalog fails to load", async () => {
      const { user } = setup({ hasGpu: true, isError: true, availableGpus: [{ vendor: "nvidia", models: [availableModel("t4")] }] });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));

      expect(await screen.findByRole("option", { name: "NVIDIA t4" })).toBeInTheDocument();
      expect(screen.queryByText(/failed to load gpu models/i)).not.toBeInTheDocument();
    });

    it("offers a model the hardware catalog does not list", async () => {
      const { user } = setup({ hasGpu: true, availableGpus: [{ vendor: "nvidia", models: [availableModel("b200")] }] });

      await user.click(screen.getByRole("combobox", { name: "GPU model" }));

      expect(await screen.findByRole("option", { name: "NVIDIA b200" })).toBeInTheDocument();
    });
  });

  describe("node capacity", () => {
    it("warns when no single node has as many free gpus of the picked model as the count asks for", () => {
      setup({
        hasGpu: true,
        gpu: 12,
        gpuModels: [{ vendor: "nvidia", name: "h100", memory: "", interface: "" }],
        availableGpus: [{ vendor: "nvidia", models: [availableModel("h100", ["80Gi"], ["sxm"], 5, 40, 8)] }]
      });

      expect(screen.getByRole("status")).toHaveTextContent("No single node has 12 of these GPUs free right now. The most one node can offer is 8.");
    });

    it("shows the warning once the count goes above what one node has free and drops it once back", async () => {
      const { user } = setup({
        hasGpu: true,
        gpu: 8,
        gpuModels: [{ vendor: "nvidia", name: "h100", memory: "", interface: "" }],
        availableGpus: [{ vendor: "nvidia", models: [availableModel("h100", ["80Gi"], ["sxm"], 5, 40, 8)] }]
      });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Increase GPUs" }));
      expect(screen.getByRole("status")).toHaveTextContent("No single node has 9 of these GPUs free right now.");

      await user.click(screen.getByRole("button", { name: "Decrease GPUs" }));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("counts only the nodes advertising the pinned memory and interface", () => {
      setup({
        hasGpu: true,
        gpu: 6,
        gpuModels: [{ vendor: "nvidia", name: "h100", memory: "80Gi", interface: "sxm" }],
        availableGpus: [
          {
            vendor: "nvidia",
            models: [
              {
                ...availableModel("h100", ["80Gi"], ["sxm"], 5, 40, 8),
                variants: [variant(null, null, 5, 8), variant("80Gi", null, 5, 8), variant(null, "sxm", 5, 8), variant("80Gi", "sxm", 1, 4)]
              }
            ]
          }
        ]
      });

      expect(screen.getByRole("status")).toHaveTextContent("The most one node can offer is 4.");
    });

    it("stays quiet while one of the alternative models fits on a single node", () => {
      setup({
        hasGpu: true,
        gpu: 6,
        gpuModels: [
          { vendor: "nvidia", name: "h100", memory: "", interface: "" },
          { vendor: "nvidia", name: "a100", memory: "", interface: "" }
        ],
        availableGpus: [{ vendor: "nvidia", models: [availableModel("h100", ["80Gi"], ["sxm"], 1, 4, 4), availableModel("a100", ["80Gi"], ["sxm"], 1, 8, 8)] }]
      });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("says no node has the gpus free when the picked model is not offered", () => {
      setup({
        hasGpu: true,
        gpuModels: [{ vendor: "nvidia", name: "a100", memory: "", interface: "" }],
        availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"])] }]
      });

      expect(screen.getByRole("status")).toHaveTextContent("No node has these GPUs free right now.");
    });

    it("warns from the first model picker before any gpu entry exists", () => {
      setup({ hasGpu: true, gpu: 4, gpuModels: [], availableGpus: [{ vendor: "nvidia", models: [availableModel("t4", ["16Gi"], ["pcie"], 1, 2, 2)] }] });

      expect(screen.getByRole("status")).toHaveTextContent("No single node has 4 of these GPUs free right now. The most one node can offer is 2.");
    });

    it("shows no warning while availability is unknown", () => {
      setup({ hasGpu: true, gpu: 24, gpuModels: [{ vendor: "nvidia", name: "h100", memory: "", interface: "" }] });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  function availableModel(
    name: string,
    memory = ["80Gi"],
    gpuInterface = ["sxm"],
    providerCount = 1,
    availableUnits = providerCount,
    maxNodeFreeUnits = 1
  ): AvailableGpuVendor["models"][number] {
    return {
      name,
      memory,
      interface: gpuInterface,
      providerCount,
      availableUnits,
      maxNodeFreeUnits,
      variants: everyVariant(memory, gpuInterface, providerCount, maxNodeFreeUnits)
    };
  }

  function variant(
    memory: string | null,
    gpuInterface: string | null,
    providerCount: number,
    maxNodeFreeUnits = 1
  ): AvailableGpuVendor["models"][number]["variants"][number] {
    return { memory, interface: gpuInterface, providerCount, availableUnits: providerCount, maxNodeFreeUnits };
  }

  function everyCatalogGpuAvailable(): AvailableGpuVendor[] {
    return [
      { vendor: "nvidia", models: [availableModel("a100", ["40Gi", "80Gi"], ["pcie", "sxm"]), availableModel("t4", ["16Gi"], ["pcie"])] },
      { vendor: "amd", models: [availableModel("mi300", ["192Gi"], ["pcie"])] }
    ];
  }

  function everyVariant(memory: string[], gpuInterface: string[], providerCount: number, maxNodeFreeUnits = 1) {
    return [null, ...memory].flatMap(size => [null, ...gpuInterface].map(option => variant(size, option, providerCount, maxNodeFreeUnits)));
  }

  const StubGpuModelFields: typeof DEPENDENCIES.GpuModelFields = ({ gpuIndex }) => <div role="group" aria-label={`GPU ${gpuIndex + 1}`} />;

  function makeGpuModels(count: number): SdlBuilderFormValuesType["services"][number]["profile"]["gpuModels"] {
    return Array.from({ length: count }, () => ({ vendor: "nvidia", name: "", memory: "", interface: "" }));
  }

  function setup(input: {
    gpu?: number;
    hasGpu?: boolean;
    gpuModels?: SdlBuilderFormValuesType["services"][number]["profile"]["gpuModels"];
    vendors?: GpuVendor[];
    availableGpus?: AvailableGpuVendor[];
    gpuError?: string;
    isLoading?: boolean;
    isError?: boolean;
    locked?: boolean;
    screened?: Record<string, Partial<ScreenedProviderCount>>;
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
      isLoading: input.isLoading ?? false,
      isError: input.isError ?? false
    } as Partial<ReturnType<typeof DEPENDENCIES.useGpuModels>>);
    gpuModelsResult.data = input.isLoading || input.isError ? undefined : input.vendors ?? GPU_VENDORS;
    const useGpuModels: typeof DEPENDENCIES.useGpuModels = () => gpuModelsResult;
    const placementOptionsQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.usePlacementOptions>>(), {
      data: input.availableGpus && { regions: [], gpus: input.availableGpus }
    });
    const usePlacementOptions: typeof DEPENDENCIES.usePlacementOptions = () => placementOptionsQuery;
    const useFieldError: typeof DEPENDENCIES.useFieldError = () => ({ error: input.gpuError });
    const analyticsService = mock<AnalyticsService>();
    const useServices: typeof DEPENDENCIES.useServices = () => mock<ReturnType<typeof DEPENDENCIES.useServices>>({ analyticsService });
    const HardwareRequestDialog = vi.fn<typeof DEPENDENCIES.HardwareRequestDialog>(() => <div>Hardware request dialog</div>);
    const useScreenedGpuModelCount = vi.fn<typeof DEPENDENCIES.useScreenedGpuModelCount>((_serviceIndex, model) => {
      const offered = input.availableGpus?.find(vendor => vendor.vendor === model.vendor)?.models.find(candidate => candidate.name === model.name);
      return { count: offered?.providerCount ?? 0, gpuCount: offered?.availableUnits ?? 0, isLoading: false, ...input.screened?.[model.name] };
    });

    let getValues: () => SdlBuilderFormValuesType = () => values;
    const Wrapper = ({ children }: PropsWithChildren) => {
      const form = useForm<SdlBuilderFormValuesType>({ defaultValues: values, mode: "onChange" });
      getValues = form.getValues;
      return <FormProvider {...form}>{children}</FormProvider>;
    };

    render(
      <Wrapper>
        <GpuCard
          serviceIndex={0}
          locked={input.locked}
          dependencies={{
            ...DEPENDENCIES,
            useGpuModels,
            usePlacementOptions,
            useFieldError,
            useServices,
            HardwareRequestDialog,
            useScreenedGpuModelCount,
            ...input.dependencies
          }}
        />
      </Wrapper>
    );

    const user = userEvent.setup();

    return { user, getValues: () => getValues(), analyticsService, HardwareRequestDialog, useScreenedGpuModelCount };
  }
});
