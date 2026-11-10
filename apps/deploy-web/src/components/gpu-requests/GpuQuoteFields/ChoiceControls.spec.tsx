import { CheckIcon } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { ChoiceChips, ChoiceTiles, FieldGroup, MultiChoiceChips, OptionCards } from "./ChoiceControls";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("ChoiceControls", () => {
  describe(ChoiceChips.name, () => {
    it("hands back the picked choice's own value", async () => {
      const onChange = vi.fn();
      render(<ChoiceChips label="Uplink" choices={UPLINK_CHOICES} value={null} onChange={onChange} />);

      expect(screen.getByRole("group", { name: "Uplink" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "No preference" })).toBeChecked();

      await userEvent.click(screen.getByRole("radio", { name: "10 Gbps Fast" }));

      expect(onChange).toHaveBeenCalledWith(10);
    });

    it("keeps the current choice when it is clicked again", async () => {
      const onChange = vi.fn();
      render(<ChoiceChips label="Uplink" choices={UPLINK_CHOICES} value={10} onChange={onChange} />);

      await userEvent.click(screen.getByRole("radio", { name: "10 Gbps Fast" }));

      expect(onChange).not.toHaveBeenCalled();
    });

    it("checks nothing when the value is not one of the choices", () => {
      render(<ChoiceChips label="Uplink" choices={UPLINK_CHOICES.slice(1)} value={null} onChange={vi.fn()} />);

      expect(screen.getByRole("radio", { name: "10 Gbps Fast" })).not.toBeChecked();
    });
  });

  describe(MultiChoiceChips.name, () => {
    it("adds and removes values in the choices' order", async () => {
      const onChange = vi.fn();
      const { rerender } = render(<MultiChoiceChips label="Areas" choices={AREA_CHOICES} values={["eu"]} onChange={onChange} />);

      expect(screen.getByRole("button", { name: "Europe" })).toHaveAttribute("aria-pressed", "true");

      await userEvent.click(screen.getByRole("button", { name: "United States" }));
      expect(onChange).toHaveBeenLastCalledWith(["us", "eu"]);

      rerender(<MultiChoiceChips label="Areas" choices={AREA_CHOICES} values={["us", "eu"]} onChange={onChange} />);
      await userEvent.click(screen.getByRole("button", { name: "United States" }));
      expect(onChange).toHaveBeenLastCalledWith(["eu"]);
    });
  });

  describe("MultiChoiceChips with a selected icon", () => {
    it("marks only the picked values with the icon", () => {
      const { container } = render(<MultiChoiceChips label="Areas" choices={AREA_CHOICES} values={["eu"]} selectedIcon={CheckIcon} onChange={vi.fn()} />);

      expect(container.querySelectorAll("svg")).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Europe" }).querySelector("svg")).toBeInTheDocument();
    });
  });

  describe(ChoiceTiles.name, () => {
    it("shows each choice's detail and badge and hands back the picked value", async () => {
      const onChange = vi.fn();
      render(
        <ChoiceTiles
          label="Uptime"
          choices={[
            { value: null, label: "No requirement", detail: "Best effort" },
            { value: "99.9", label: "99.9%", detail: "44 min", badge: <span>Rare</span>, isNumeric: true }
          ]}
          value={null}
          onChange={onChange}
        />
      );

      expect(screen.getByRole("radio", { name: "No requirement Best effort" })).toBeChecked();
      expect(screen.getByText("99.9%")).toHaveClass("font-mono");
      expect(screen.getByText("No requirement")).not.toHaveClass("font-mono");

      await userEvent.click(screen.getByRole("radio", { name: "99.9% Rare 44 min" }));
      expect(onChange).toHaveBeenCalledWith("99.9");
    });

    it("keeps the current choice when it is clicked again", async () => {
      const onChange = vi.fn();
      render(<ChoiceTiles label="Uptime" choices={[{ value: "99", label: "99%" }]} value="99" onChange={onChange} />);

      await userEvent.click(screen.getByRole("radio", { name: "99%" }));

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe(OptionCards.name, () => {
    it("shows each option's detail and spec and hands back the picked value", async () => {
      const onChange = vi.fn();
      render(
        <OptionCards
          label="Network"
          options={[
            { value: "infiniband", label: "InfiniBand", spec: "GPUDirect RDMA" },
            { value: "any", label: "No preference", detail: "Either" }
          ]}
          value="infiniband"
          onChange={onChange}
        />
      );

      expect(screen.getByRole("radiogroup", { name: "Network" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "InfiniBand" })).toBeChecked();
      expect(screen.getByText("GPUDirect RDMA")).toBeInTheDocument();
      expect(screen.getByText("Either")).toBeInTheDocument();

      await userEvent.click(screen.getByText("No preference"));
      expect(onChange).toHaveBeenCalledWith("any");
    });
  });

  describe(FieldGroup.name, () => {
    it("shows its label, hint and content", () => {
      render(
        <FieldGroup label="Terabytes" hint="In each server">
          <span>content</span>
        </FieldGroup>
      );

      expect(screen.getByText("Terabytes")).toBeInTheDocument();
      expect(screen.getByText("In each server")).toBeInTheDocument();
      expect(screen.getByText("content")).toBeInTheDocument();
    });
  });

  const UPLINK_CHOICES = [
    { value: null, label: "No preference" },
    { value: 10, label: "10 Gbps", detail: "Fast" }
  ];

  const AREA_CHOICES = [
    { value: "us", label: "United States" },
    { value: "eu", label: "Europe" }
  ];
});
