import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { CpuFilterPopover, GpuFilterPopover, RegionFilterPopover } from "./ProviderFilterPopover";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("ProviderFilterPopover", () => {
  describe("RegionFilterPopover", () => {
    it("lists the regions with how many providers sit in each", async () => {
      setupRegion({
        options: [
          { value: "eu-central", count: 7 },
          { value: "na-us-west", count: 3 }
        ],
        selected: []
      });

      await userEvent.click(screen.getByRole("button", { name: "Filter by region" }));

      expect(screen.getByRole("checkbox", { name: "EU Central 7" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("checkbox", { name: "NA US West 3" })).toBeInTheDocument();
      expect(screen.queryByText("No regions match.")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    });

    it("leaves the trigger plain while no region is picked", () => {
      setupRegion({ options: [{ value: "eu-central", count: 7 }], selected: [] });

      const trigger = screen.getByRole("button", { name: "Filter by region" });
      expect(trigger).toHaveAttribute("data-active", "false");
      expect(trigger).toHaveTextContent(/^Region$/);
    });

    it("marks the trigger with how many regions are picked", () => {
      setupRegion({
        options: [
          { value: "eu-central", count: 7 },
          { value: "na-us-west", count: 3 }
        ],
        selected: ["eu-central", "na-us-west"]
      });

      const trigger = screen.getByRole("button", { name: "Filter by region, 2 selected" });
      expect(trigger).toHaveAttribute("data-active", "true");
      expect(trigger).toHaveTextContent(/^Region2$/);
    });

    it("adds a region the user ticks", async () => {
      const { onChange } = setupRegion({
        options: [
          { value: "eu-central", count: 7 },
          { value: "na-us-west", count: 3 }
        ],
        selected: ["na-us-west"]
      });

      await userEvent.click(screen.getByRole("button", { name: "Filter by region, 1 selected" }));

      expect(screen.getByText("1 region selected")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("checkbox", { name: /EU Central/ }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith(["na-us-west", "eu-central"]);
    });

    it("removes a region the user unticks and keeps the others", async () => {
      const { onChange } = setupRegion({
        options: [
          { value: "eu-central", count: 7 },
          { value: "na-us-west", count: 3 }
        ],
        selected: ["eu-central", "na-us-west"]
      });

      await userEvent.click(screen.getByRole("button", { name: /Filter by region/ }));
      await userEvent.click(screen.getByRole("checkbox", { name: /EU Central/ }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith(["na-us-west"]);
    });

    it("matches the typed text whatever its case and surrounding spaces", async () => {
      setupRegion({
        options: [
          { value: "eu-central", count: 7 },
          { value: "na-us-west", count: 3 }
        ],
        selected: []
      });

      await userEvent.click(screen.getByRole("button", { name: "Filter by region" }));
      await userEvent.type(screen.getByRole("textbox", { name: "Search regions" }), "  EU CENTRAL ");

      expect(screen.getByRole("checkbox", { name: /EU Central/ })).toBeInTheDocument();
      expect(screen.queryByRole("checkbox", { name: /NA US West/ })).not.toBeInTheDocument();
    });

    it("matches a region by its code", async () => {
      setupRegion({
        options: [
          { value: "eu-central", count: 7 },
          { value: "na-us-west", count: 3 }
        ],
        selected: []
      });

      await userEvent.click(screen.getByRole("button", { name: "Filter by region" }));
      await userEvent.type(screen.getByRole("textbox", { name: "Search regions" }), "us-west");

      expect(screen.getByRole("checkbox", { name: /NA US West/ })).toBeInTheDocument();
      expect(screen.queryByRole("checkbox", { name: /EU Central/ })).not.toBeInTheDocument();
    });

    it("narrows the regions to the typed text and says when none match", async () => {
      setupRegion({
        options: [
          { value: "eu-central", count: 7 },
          { value: "na-us-west", count: 3 }
        ],
        selected: []
      });

      await userEvent.click(screen.getByRole("button", { name: "Filter by region" }));
      await userEvent.type(screen.getByRole("textbox", { name: "Search regions" }), "us west");

      expect(screen.queryByRole("checkbox", { name: /EU Central/ })).not.toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /NA US West/ })).toBeInTheDocument();

      await userEvent.type(screen.getByRole("textbox", { name: "Search regions" }), "zzz");

      expect(screen.getByText("No regions match.")).toBeInTheDocument();
    });

    it("clears the picked regions", async () => {
      const { onChange } = setupRegion({
        options: [
          { value: "eu-central", count: 7 },
          { value: "na-us-west", count: 3 }
        ],
        selected: ["eu-central", "na-us-west"]
      });

      await userEvent.click(screen.getByRole("button", { name: /Filter by region/ }));

      expect(screen.getByText("2 regions selected")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Clear" }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith([]);
    });
  });

  describe("GpuFilterPopover", () => {
    it("keeps only GPU providers when the user ticks it", async () => {
      const { onChange } = setupGpu({ options: [{ value: "h100", count: 2 }], selected: [], isGpuOnly: false });

      await userEvent.click(screen.getByRole("button", { name: "Filter by gpu" }));

      expect(screen.queryByText("No GPU models on the network right now.")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("checkbox", { name: "GPU providers only" }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ isGpuOnly: true });
    });

    it("adds a GPU model the user ticks", async () => {
      const { onChange } = setupGpu({
        options: [
          { value: "h100", count: 2 },
          { value: "a100", count: 1 }
        ],
        selected: ["a100"],
        isGpuOnly: true
      });

      await userEvent.click(screen.getByRole("button", { name: "Filter by gpu, 2 selected" }));
      await userEvent.click(screen.getByRole("checkbox", { name: /H100/ }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ gpuModels: ["a100", "h100"] });
    });

    it("clears the models and the GPU-only filter together", async () => {
      const { onChange } = setupGpu({ options: [{ value: "h100", count: 2 }], selected: ["h100"], isGpuOnly: true });

      await userEvent.click(screen.getByRole("button", { name: /Filter by gpu/ }));

      expect(screen.getByText("2 filters selected")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Clear" }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ gpuModels: [], isGpuOnly: false });
    });

    it("says when no GPU model is on the network", async () => {
      setupGpu({ options: [], selected: [], isGpuOnly: false });

      await userEvent.click(screen.getByRole("button", { name: "Filter by gpu" }));

      expect(screen.getByText("No GPU models on the network right now.")).toBeInTheDocument();
    });
  });

  describe("CpuFilterPopover", () => {
    it("groups the CPU vendors, generations and models with how many providers run each", async () => {
      setupCpu({});

      await userEvent.click(screen.getByRole("button", { name: "Filter by cpu" }));

      expect(within(screen.getByRole("group", { name: "CPU vendor" })).getByRole("checkbox", { name: /AMD\s*3/ })).toBeInTheDocument();
      expect(within(screen.getByRole("group", { name: "CPU generation" })).getByRole("checkbox", { name: /Milan\s*2/ })).toBeInTheDocument();
      expect(within(screen.getByRole("group", { name: "CPU model" })).getByRole("checkbox", { name: /EPYC 7763\s*2/ })).toBeInTheDocument();
      expect(screen.queryByText("No CPU models reported on the network right now.")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
    });

    it.each([
      ["vendor", /Intel/, { cpuVendors: ["AMD", "Intel"] }],
      ["generation", /Genoa/, { cpuGenerations: ["Milan", "Genoa"] }],
      ["model", /EPYC 9654/, { cpuModels: ["EPYC 7763", "EPYC 9654"] }]
    ])("adds a CPU %s the user ticks to the ones already picked", async (_, name, change) => {
      const { onChange } = setupCpu({ selected: { cpuVendors: ["AMD"], cpuGenerations: ["Milan"], cpuModels: ["EPYC 7763"] } });

      await userEvent.click(screen.getByRole("button", { name: "Filter by cpu, 3 selected" }));
      await userEvent.click(screen.getByRole("checkbox", { name }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith(change);
    });

    it("removes a CPU vendor the user unticks", async () => {
      const { onChange } = setupCpu({ selected: { cpuVendors: ["AMD"], cpuGenerations: [], cpuModels: [] } });

      await userEvent.click(screen.getByRole("button", { name: "Filter by cpu, 1 selected" }));
      expect(screen.getByRole("checkbox", { name: /AMD/ })).toBeChecked();
      await userEvent.click(screen.getByRole("checkbox", { name: /AMD/ }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ cpuVendors: [] });
    });

    it("clears the vendors, generations and models together", async () => {
      const { onChange } = setupCpu({ selected: { cpuVendors: ["AMD"], cpuGenerations: ["Milan"], cpuModels: [] } });

      await userEvent.click(screen.getByRole("button", { name: /Filter by cpu/ }));

      expect(screen.getByText("2 filters selected")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Clear" }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ cpuVendors: [], cpuGenerations: [], cpuModels: [] });
    });

    it("leaves out a group with nothing to offer", async () => {
      setupCpu({ generationOptions: [] });

      await userEvent.click(screen.getByRole("button", { name: "Filter by cpu" }));

      expect(screen.queryByRole("group", { name: "CPU generation" })).not.toBeInTheDocument();
      expect(screen.getByRole("group", { name: "CPU vendor" })).toBeInTheDocument();
      expect(screen.queryByText("No CPU models reported on the network right now.")).not.toBeInTheDocument();
    });

    it("says when no provider reports its CPUs", async () => {
      setupCpu({ vendorOptions: [], generationOptions: [], modelOptions: [] });

      await userEvent.click(screen.getByRole("button", { name: "Filter by cpu" }));

      expect(screen.getByText("No CPU models reported on the network right now.")).toBeInTheDocument();
      expect(screen.queryByRole("group")).not.toBeInTheDocument();
    });
  });

  it("draws a column header trigger flat and a toolbar trigger as a bordered chip", () => {
    setupRegion({ options: [], selected: [], variant: "header" });
    setupGpu({ options: [], selected: [], isGpuOnly: false, variant: "toolbar" });

    const headerTrigger = screen.getByRole("button", { name: "Filter by region" });
    const toolbarTrigger = screen.getByRole("button", { name: "Filter by gpu" });
    expect(headerTrigger).toHaveClass("rounded-md");
    expect(headerTrigger).not.toHaveClass("border");
    expect(toolbarTrigger).toHaveClass("rounded-lg", "border");
    expect(toolbarTrigger).not.toHaveClass("rounded-md");
  });

  function setupRegion(input: { options: { value: string; count: number }[]; selected: string[]; variant?: "header" | "toolbar" }) {
    const onChange = vi.fn();
    render(<RegionFilterPopover options={input.options} selected={input.selected} onChange={onChange} variant={input.variant ?? "header"} />);
    return { onChange };
  }

  function setupCpu(input: Partial<ComponentProps<typeof CpuFilterPopover>>) {
    const onChange = vi.fn();
    render(
      <CpuFilterPopover
        vendorOptions={[
          { value: "AMD", count: 3 },
          { value: "Intel", count: 1 }
        ]}
        generationOptions={[
          { value: "Milan", count: 2 },
          { value: "Genoa", count: 1 }
        ]}
        modelOptions={[
          { value: "EPYC 7763", count: 2 },
          { value: "EPYC 9654", count: 1 }
        ]}
        selected={{ cpuVendors: [], cpuGenerations: [], cpuModels: [] }}
        onChange={onChange}
        variant="toolbar"
        {...input}
      />
    );
    return { onChange };
  }

  function setupGpu(input: { options: { value: string; count: number }[]; selected: string[]; isGpuOnly: boolean; variant?: "header" | "toolbar" }) {
    const onChange = vi.fn();
    render(
      <GpuFilterPopover
        options={input.options}
        selected={input.selected}
        isGpuOnly={input.isGpuOnly}
        onChange={onChange}
        variant={input.variant ?? "toolbar"}
      />
    );
    return { onChange };
  }
});
