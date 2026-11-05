import { describe, expect, it, vi } from "vitest";

import type { GpuQuoteDraft } from "../gpuQuoteDraft/gpuQuoteDraft";
import { configurationStartingPoint, createBlankDraft, CUSTOM_STARTING_POINT, STARTER_PACKAGES } from "../gpuQuoteDraft/gpuQuoteDraft";
import { GpuField, InterconnectField, StartingPointField, StorageField } from "./HardwareFields";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("HardwareFields", () => {
  describe(StartingPointField.name, () => {
    it("shows each package as its GPUs and specs, and picks one", async () => {
      const onPick = vi.fn();
      render(<StartingPointField startingPoints={[...STARTER_PACKAGES, CUSTOM_STARTING_POINT]} value="custom" onPick={onPick} />);

      expect(screen.getByRole("radio", { name: /Custom/ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /Full server/ }).closest("label")).toHaveTextContent(
        "Full serverFine-tuning and large modelsNVIDIA · 141 GB8×H200Nodes1 × 8 GPUsLinkNVLinkStorage8 TB / nodeInternet10 Gbps"
      );
      expect(screen.getByRole("radiogroup", { name: "Starting point" })).toHaveClass("sm:grid-cols-3");

      await userEvent.click(screen.getByRole("radio", { name: /Training cluster/ }));

      expect(onPick).toHaveBeenCalledWith(STARTER_PACKAGES[1]);
    });

    it("shows what the configuration was set up with and lays four packages out two by two", () => {
      const configuration = configurationStartingPoint({ gpuCount: 1, gpuModels: ["h100"], storageBytes: 0, regions: [] }, "4 vCPU · 1× H100");
      render(<StartingPointField startingPoints={[configuration, ...STARTER_PACKAGES, CUSTOM_STARTING_POINT]} value="configuration" onPick={vi.fn()} />);

      expect(screen.getByRole("radio", { name: /Your configuration/ })).toBeChecked();
      expect(screen.getByText("4 vCPU · 1× H100")).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Starting point" })).toHaveClass("sm:grid-cols-2");
    });
  });

  describe(GpuField.name, () => {
    it("picks a model from the catalog", async () => {
      const { onChange } = setup({ Field: GpuField, answers: { gpuModel: "h100" } });

      expect(screen.getByRole("radio", { name: "H100 80 GB" })).toBeChecked();

      await userEvent.click(screen.getByRole("radio", { name: "MI300X 192 GB" }));

      expect(onChange).toHaveBeenCalledWith({ gpuModel: "mi300x" });
    });

    it("asks which GPU when something else is picked", async () => {
      const { onChange } = setup({ Field: GpuField, answers: { gpuModel: "other", otherGpuModel: "" } });

      await userEvent.type(screen.getByLabelText("Which GPU?"), "G");

      expect(onChange).toHaveBeenCalledWith({ otherGpuModel: "G" });
    });

    it("hides the free text field for a catalog model", () => {
      setup({ Field: GpuField, answers: { gpuModel: "a100" } });

      expect(screen.queryByLabelText("Which GPU?")).not.toBeInTheDocument();
    });

    it("offers single GPUs without asking for servers", async () => {
      const { onChange } = setup({ Field: GpuField, answers: { gpuCount: 2 } });

      expect(screen.getByRole("radio", { name: "2 GPUs" })).toBeChecked();
      expect(screen.queryByRole("spinbutton", { name: "Servers" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("radio", { name: "4 GPUs" }));
      expect(onChange).toHaveBeenLastCalledWith({ gpuCount: 4 });

      await userEvent.click(screen.getByRole("radio", { name: "Whole servers of 8" }));
      expect(onChange).toHaveBeenLastCalledWith({ gpuCount: 8 });
    });

    it("counts whole servers of 8 GPUs", async () => {
      const { onChange } = setup({ Field: GpuField, answers: { gpuCount: 16 } });

      expect(screen.getByRole("radio", { name: "Whole servers of 8" })).toBeChecked();
      expect(screen.getByText("16 GPUs in total")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Increase Servers" }));

      expect(onChange).toHaveBeenCalledWith({ gpuCount: 24 });
    });
  });

  describe(InterconnectField.name, () => {
    it("asks for the network and speed only when servers are linked", async () => {
      const { onChange } = setup({ Field: InterconnectField, answers: { gpuCount: 16, interconnect: "server" } });

      expect(screen.queryByRole("group", { name: "Network between servers" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("radio", { name: /Linked across servers/ }));

      expect(onChange).toHaveBeenCalledWith({ interconnect: "cluster" });
    });

    it("sets the network and speed of a cluster", async () => {
      const { onChange } = setup({ Field: InterconnectField, answers: { gpuCount: 16, interconnect: "cluster", fabric: "any", fabricGbps: 400 } });

      expect(within(screen.getByRole("group", { name: "Speed per GPU" })).getByRole("radio", { name: "400 Gb/s" })).toBeChecked();

      await userEvent.click(screen.getByRole("radio", { name: "InfiniBand" }));
      expect(onChange).toHaveBeenLastCalledWith({ fabric: "infiniband" });

      await userEvent.click(screen.getByRole("radio", { name: "800 Gb/s" }));
      expect(onChange).toHaveBeenLastCalledWith({ fabricGbps: 800 });
    });
  });

  describe(StorageField.name, () => {
    it("sets the storage size and fast local disk", async () => {
      const { onChange } = setup({ Field: StorageField, answers: { storageTbPerNode: 4, nvme: true } });

      expect(screen.queryByText("In each server")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Increase Storage in TB" }));
      expect(onChange).toHaveBeenLastCalledWith({ storageTbPerNode: 5 });

      await userEvent.click(screen.getByRole("switch", { name: /Fast local disk/ }));
      expect(onChange).toHaveBeenLastCalledWith({ nvme: false });
    });

    it("says the storage is per server for whole servers", () => {
      setup({ Field: StorageField, answers: { gpuCount: 8 } });

      expect(screen.getByText("In each server")).toBeInTheDocument();
    });
  });

  function setup(input: { Field: typeof GpuField; answers: Partial<GpuQuoteDraft> }) {
    const onChange = vi.fn();
    render(<input.Field draft={{ ...createBlankDraft("me@example.com"), ...input.answers }} onChange={onChange} />);
    return { onChange };
  }
});
