import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GpuQuoteDraft } from "../gpuQuoteDraft/gpuQuoteDraft";
import { createBlankDraft } from "../gpuQuoteDraft/gpuQuoteDraft";
import type { DraftFieldProps } from "./HardwareFields";
import { ContactField, RegionField, SlaField, TimingField } from "./RequestFields";

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("RequestFields", () => {
  describe(RegionField.name, () => {
    it("runs anywhere without asking for areas", async () => {
      const { onChange } = setup({ Field: RegionField, answers: { regionMode: "any" } });

      expect(screen.getByRole("radio", { name: "Anywhere" })).toBeChecked();
      expect(screen.queryByRole("group", { name: "Regions to run in" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("radio", { name: "Only in…" }));

      expect(onChange).toHaveBeenCalledWith({ regionMode: "only" });
    });

    it("picks the areas they can run in", async () => {
      const { onChange } = setup({ Field: RegionField, answers: { regionMode: "only", areas: ["eu"] } });

      await userEvent.click(screen.getByRole("button", { name: "Asia Pacific" }));

      expect(screen.getByRole("group", { name: "Regions to run in" })).toBeInTheDocument();
      expect(onChange).toHaveBeenCalledWith({ areas: ["eu", "apac"] });
    });

    it("picks the areas they can't run in", () => {
      setup({ Field: RegionField, answers: { regionMode: "except", areas: [] } });

      expect(screen.getByRole("group", { name: "Regions to leave out" })).toBeInTheDocument();
    });

    it("doesn't ask for internet speed", () => {
      setup({ Field: RegionField, answers: {} });

      expect(screen.queryByRole("group", { name: "Internet speed" })).not.toBeInTheDocument();
    });
  });

  describe(SlaField.name, () => {
    it("picks an uptime guarantee", async () => {
      const { onChange } = setup({ Field: SlaField, answers: { sla: null } });

      expect(screen.getByRole("radio", { name: /No requirement/ })).toBeChecked();

      await userEvent.click(screen.getByRole("radio", { name: /99.9%/ }));

      expect(onChange).toHaveBeenCalledWith({ sla: "99.9" });
    });
  });

  describe(TimingField.name, () => {
    it("picks a term and a start", async () => {
      const { onChange } = setup({ Field: TimingField, answers: { start: "asap" } });

      expect(screen.queryByLabelText("Start date")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("radio", { name: "1 year" }));
      expect(onChange).toHaveBeenLastCalledWith({ term: "12_months" });

      await userEvent.click(screen.getByRole("radio", { name: "On a date" }));
      expect(onChange).toHaveBeenLastCalledWith({ start: "date" });
    });

    it("offers every term but 3 months", () => {
      setup({ Field: TimingField, answers: {} });

      expect(within(screen.getByRole("group", { name: "Term" })).getAllByRole("radio").map(term => term.textContent)).toEqual([
        "Month to month",
        "6 months",
        "1 year",
        "2 years or more"
      ]);
    });

    it("asks for a start date from today on", () => {
      const { onChange } = setup({ Field: TimingField, answers: { start: "date", startDate: "" } });
      const startDate = screen.getByLabelText("Start date");

      fireEvent.change(startDate, { target: { value: "2026-12-01" } });

      expect(startDate).toHaveAttribute("min", "2026-11-04");
      expect(onChange).toHaveBeenCalledWith({ startDate: "2026-12-01" });
    });
  });

  describe(ContactField.name, () => {
    it("fills in the contact details", () => {
      const { onChange } = setup({ Field: ContactField, answers: {} });

      expect(screen.getByLabelText("Email")).toHaveValue("me@example.com");

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ops@example.com" } });
      expect(onChange).toHaveBeenLastCalledWith({ email: "ops@example.com" });

      fireEvent.change(screen.getByLabelText(/Phone/), { target: { value: "+1 555" } });
      expect(onChange).toHaveBeenLastCalledWith({ phone: "+1 555" });

      fireEvent.change(screen.getByLabelText(/Company/), { target: { value: "Acme" } });
      expect(onChange).toHaveBeenLastCalledWith({ company: "Acme" });

      fireEvent.change(screen.getByLabelText(/Anything else/), { target: { value: "Training" } });
      expect(onChange).toHaveBeenLastCalledWith({ notes: "Training" });
    });
  });

  function setup(input: { Field: (props: DraftFieldProps & { today: string }) => ReactNode; answers: Partial<GpuQuoteDraft> }) {
    const onChange = vi.fn();
    render(<input.Field draft={{ ...createBlankDraft("me@example.com"), ...input.answers }} onChange={onChange} today="2026-11-04" />);
    return { onChange };
  }
});
