import { describe, expect, it, vi } from "vitest";

import type { GpuQuoteDraft } from "../gpuQuoteDraft/gpuQuoteDraft";
import { configurationStartingPoint, createBlankDraft, CUSTOM_STARTING_POINT, STARTER_PACKAGES } from "../gpuQuoteDraft/gpuQuoteDraft";
import { GpuField, InterconnectField, StartingPointField, StorageField } from "./HardwareFields";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("HardwareFields", () => {
  describe(StartingPointField.name, () => {
    it("shows each package as its GPUs and specs, and picks one", async () => {
      const onPick = vi.fn();
      render(<StartingPointField startingPoints={[...STARTER_PACKAGES, CUSTOM_STARTING_POINT]} value="custom" onPick={onPick} />);

      expect(screen.getByRole("radio", { name: /Custom/ })).toBeChecked();
      expect(screen.getByRole("radio", { name: /Full server/ }).closest("label")).toHaveTextContent(
        "Full serverFine-tuning and large modelsNVIDIA RTX · 96 GB8×PRO 6000Nodes1 × 8 GPUsNetworkInfiniBandStorage8 TB / node"
      );
      expect(screen.getByRole("radiogroup", { name: "Starting point" })).toHaveClass("sm:grid-cols-3");

      await userEvent.click(screen.getByRole("radio", { name: /Training cluster/ }));

      expect(onPick).toHaveBeenCalledWith(STARTER_PACKAGES[1]);
    });

    it("shows what the configuration was set up with and lays four packages out two by two", () => {
      const configuration = configurationStartingPoint({ gpuCount: 1, gpuModels: [], storageBytes: 0, regions: [] }, "4 vCPU · 1× GPU");
      render(<StartingPointField startingPoints={[configuration, ...STARTER_PACKAGES, CUSTOM_STARTING_POINT]} value="configuration" onPick={vi.fn()} />);

      expect(screen.getByRole("radio", { name: /Your configuration/ })).toBeChecked();
      expect(screen.getByText("4 vCPU · 1× GPU")).toBeInTheDocument();
      expect(screen.getByText("From your SDL")).toBeInTheDocument();
      expect(screen.getByRole("radiogroup", { name: "Starting point" })).toHaveClass("sm:grid-cols-2");
    });
  });

  describe(GpuField.name, () => {
    it("searches the catalog for a model and shows its memory", async () => {
      const { onChange } = setup({ Field: GpuField, answers: { gpuModel: "h100", gpuCount: 16 } });

      expect(screen.getByRole("combobox", { name: "GPU model" })).toHaveTextContent("NVIDIA H100");
      expect(screen.getByText("80 GB memory each")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("combobox", { name: "GPU model" }));
      await userEvent.type(screen.getByPlaceholderText("Search GPUs…"), "instinct");
      expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["AMD MI355X288 GB", "AMD MI325X256 GB", "AMD MI300X192 GB"]);

      await userEvent.click(screen.getByRole("option", { name: /MI300X/ }));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ gpuModel: "mi300x", gpuCount: 16 }));
    });

    it("lists the RTX PRO 6000 as its server edition, says how many GPUs a rack holds and no longer offers the L40S", async () => {
      setup({ Field: GpuField, answers: {} });

      expect(screen.getByRole("combobox", { name: "GPU model" })).toHaveTextContent("Choose a GPU");
      await userEvent.click(screen.getByRole("combobox", { name: "GPU model" }));

      expect(screen.getByRole("option", { name: /NVIDIA RTX PRO 6000 Server Edition/ })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /NVIDIA GB300/ })).toHaveTextContent("288 GB · 72 per rack");
      expect(screen.getByRole("option", { name: "Something else…" })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: /L40S/ })).not.toBeInTheDocument();
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

    it("counts whole nodes of 8 GPUs", async () => {
      const { onChange } = setup({ Field: GpuField, answers: { gpuModel: "h100", gpuCount: 16 } });

      expect(screen.getByText("How many nodes?")).toBeInTheDocument();
      expect(screen.getByText("8 GPUs per node")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "2" })).toBeChecked();
      expect(screen.getByText("2 nodes × 8 GPUs =")).toBeInTheDocument();
      expect(screen.getByText("16 GPUs total")).toBeInTheDocument();
      expect(screen.getAllByRole("radio").map(radio => radio.textContent)).toEqual(["1", "2", "4", "8", "16", "32"]);

      await userEvent.click(screen.getByRole("button", { name: "Increase nodes" }));
      expect(onChange).toHaveBeenLastCalledWith({ gpuCount: 24 });

      await userEvent.click(screen.getByRole("radio", { name: "32" }));
      expect(onChange).toHaveBeenLastCalledWith({ gpuCount: 256 });
    });

    it("counts a rack-scale model in whole racks of 72, up to the most GPUs a request can ask for", async () => {
      const { onChange } = setup({ Field: GpuField, answers: { gpuModel: "gb300", gpuCount: 936 } });

      expect(screen.getByText("How many racks?")).toBeInTheDocument();
      expect(screen.getByText("72 GPUs per rack")).toBeInTheDocument();
      expect(screen.getByText("13 racks × 72 GPUs =")).toBeInTheDocument();
      expect(screen.getAllByRole("radio").map(radio => radio.textContent)).toEqual(["1", "2", "4", "8"]);
      expect(screen.getByRole("button", { name: "Increase racks" })).toBeDisabled();

      await userEvent.click(screen.getByRole("radio", { name: "1" }));
      expect(onChange).toHaveBeenLastCalledWith({ gpuCount: 72 });
    });

    it("names a single node in the singular", () => {
      setup({ Field: GpuField, answers: { gpuModel: "h100", gpuCount: 8 } });

      expect(screen.getByText("1 node × 8 GPUs =")).toBeInTheDocument();
    });
  });

  describe(InterconnectField.name, () => {
    it("picks the network between servers, InfiniBand first and picked by default", async () => {
      const { onChange } = setup({ Field: InterconnectField, answers: { gpuModel: "b300", gpuCount: 16 } });
      const networks = screen.getAllByRole("radio");

      expect(networks.map(network => network.closest("label")?.textContent)).toEqual([
        "InfiniBandGPUDirect RDMA",
        "RoCE (Ethernet)RDMA over Converged Ethernet",
        "No preferenceOffers can use either network."
      ]);
      expect(networks[0]).toBeChecked();
      expect(screen.getByText("Inside each server, B300 GPUs connect over NVLink.")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("radio", { name: "RoCE (Ethernet)" }));
      expect(onChange).toHaveBeenLastCalledWith({ fabric: "roce" });
    });

    it("says how GPUs connect inside a rack, or over PCIe in servers without NVLink", () => {
      const { rerender } = setup({ Field: InterconnectField, answers: { gpuModel: "gb300", gpuCount: 72 } });
      expect(screen.getByText("Inside each rack, GB300 GPUs connect over NVLink.")).toBeInTheDocument();

      rerender({ gpuModel: "pro6000" });
      expect(screen.getByText("Inside each server, RTX PRO 6000 Server Edition GPUs connect over PCIe.")).toBeInTheDocument();

      rerender({ gpuModel: "other" });
      expect(screen.queryByText(/Inside each/)).not.toBeInTheDocument();
    });
  });

  describe(StorageField.name, () => {
    it("sets the storage size and fast local disk", async () => {
      const { onChange } = setup({ Field: StorageField, answers: { gpuModel: "h100", gpuCount: 16, storageTbPerNode: 4, nvme: true } });

      expect(screen.getByText("4 TB × 2 nodes =")).toBeInTheDocument();
      expect(screen.getByText("8 TB total")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Increase Storage in TB" }));
      expect(onChange).toHaveBeenLastCalledWith({ storageTbPerNode: 5 });

      await userEvent.click(screen.getByRole("radio", { name: "30 TB" }));
      expect(onChange).toHaveBeenLastCalledWith({ storageTbPerNode: 30 });

      await userEvent.click(screen.getByRole("switch", { name: /Fast local disk/ }));
      expect(onChange).toHaveBeenLastCalledWith({ nvme: false });
    });

    it("starts at 10 TB and marks it recommended", () => {
      setup({ Field: StorageField, answers: {} });

      expect(screen.getByRole("spinbutton", { name: "Storage in TB" })).toHaveValue(10);
      expect(screen.getByRole("radio", { name: "10 TB Recommended" })).toBeChecked();
      expect(screen.getAllByRole("radio").map(radio => radio.textContent)).toEqual(["1 TB", "4 TB", "10 TBRecommended", "30 TB", "100 TB"]);
    });

    it("leaves out the total without storage", () => {
      setup({ Field: StorageField, answers: { storageTbPerNode: 0 } });

      expect(screen.queryByText(/TB total/)).not.toBeInTheDocument();
    });
  });

  function setup(input: { Field: typeof GpuField; answers: Partial<GpuQuoteDraft> }) {
    const onChange = vi.fn();
    const draft = { ...createBlankDraft("me@example.com"), ...input.answers };
    const { rerender } = render(<input.Field draft={draft} onChange={onChange} />);

    return { onChange, rerender: (answers: Partial<GpuQuoteDraft>) => rerender(<input.Field draft={{ ...draft, ...answers }} onChange={onChange} />) };
  }
});
