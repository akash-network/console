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
        "Full serverFine-tuning and large modelsNVIDIA · 96 GB8×RTX PRO 6000 SENodes1 × 8 GPUsLinkPCIe onlyStorage8 TB / node"
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

    it("lists the RTX PRO 6000 models with the data center GPUs and no longer offers the L40S", () => {
      setup({ Field: GpuField, answers: {} });
      const dataCenterGpus = within(screen.getByRole("group", { name: "NVIDIA data center" }));

      expect(dataCenterGpus.getByRole("radio", { name: "RTX PRO 6000 SE 96 GB" })).toBeInTheDocument();
      expect(dataCenterGpus.getByRole("radio", { name: "RTX PRO 6000 96 GB" })).toBeInTheDocument();
      expect(screen.queryByRole("radio", { name: /L40S/ })).not.toBeInTheDocument();
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
    it("asks only for the network between servers, InfiniBand first and picked by default", async () => {
      const { onChange } = setup({ Field: InterconnectField, answers: { gpuCount: 16 } });
      const networks = screen.getAllByRole("radio");

      expect(networks.map(network => network.textContent)).toEqual(["InfiniBand", "RoCE (Ethernet)", "No preference"]);
      expect(networks[0]).toBeChecked();
      expect(screen.queryByText(/Speed per GPU/)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("radio", { name: "RoCE (Ethernet)" }));
      expect(onChange).toHaveBeenLastCalledWith({ fabric: "roce" });
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

    it("starts at the recommended 10 TB", () => {
      setup({ Field: StorageField, answers: {} });

      expect(screen.getByRole("spinbutton", { name: "Storage in TB" })).toHaveValue(10);
      expect(screen.getByText("10 TB recommended")).toBeInTheDocument();
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
