import { describe, expect, it, vi } from "vitest";

import { GpuFilterPopover, RegionFilterPopover } from "./ProviderFilterPopover";

import { render, screen } from "@testing-library/react";
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

      expect(screen.getByRole("checkbox", { name: /EU Central/ })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("checkbox", { name: /NA US West/ })).toHaveTextContent("3");
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
      await userEvent.click(screen.getByRole("checkbox", { name: /EU Central/ }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith(["na-us-west", "eu-central"]);
    });

    it("removes a region the user unticks", async () => {
      const { onChange } = setupRegion({ options: [{ value: "eu-central", count: 7 }], selected: ["eu-central"] });

      await userEvent.click(screen.getByRole("button", { name: /Filter by region/ }));
      await userEvent.click(screen.getByRole("checkbox", { name: /EU Central/ }));

      expect(onChange).toHaveBeenCalledExactlyOnceWith([]);
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

  function setupRegion(input: { options: { value: string; count: number }[]; selected: string[] }) {
    const onChange = vi.fn();
    render(<RegionFilterPopover options={input.options} selected={input.selected} onChange={onChange} variant="header" />);
    return { onChange };
  }

  function setupGpu(input: { options: { value: string; count: number }[]; selected: string[]; isGpuOnly: boolean }) {
    const onChange = vi.fn();
    render(<GpuFilterPopover options={input.options} selected={input.selected} isGpuOnly={input.isGpuOnly} onChange={onChange} variant="toolbar" />);
    return { onChange };
  }
});
