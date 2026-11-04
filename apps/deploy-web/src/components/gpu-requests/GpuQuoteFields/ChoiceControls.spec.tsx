import { describe, expect, it, vi } from "vitest";

import { ChoiceChips, FieldGroup, MultiChoiceChips, OptionCards } from "./ChoiceControls";

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

  describe(OptionCards.name, () => {
    it("shows each option's details and picks one", async () => {
      const onChange = vi.fn();
      render(
        <OptionCards
          label="Interconnect"
          options={[
            { value: "none", title: "Not needed", description: "Separate work.", detail: "PCIe only" },
            { value: "server", title: "Linked", description: "Shared memory." }
          ]}
          value={null}
          onChange={onChange}
        />
      );

      expect(screen.getByText("PCIe only")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("radio", { name: /Linked/ }));

      expect(onChange).toHaveBeenCalledWith("server");
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
