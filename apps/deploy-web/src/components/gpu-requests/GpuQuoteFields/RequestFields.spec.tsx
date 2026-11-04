import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { GpuQuoteDraft } from "../gpuQuoteDraft/gpuQuoteDraft";
import { createBlankDraft } from "../gpuQuoteDraft/gpuQuoteDraft";
import type { DraftFieldProps } from "./HardwareFields";
import { ContactField, ExtrasField, PriceField, RegionField, SlaField, TimingField } from "./RequestFields";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("RequestFields", () => {
  describe(RegionField.name, () => {
    it("runs anywhere without asking for areas", async () => {
      const { onChange } = setup({ Field: RegionField, answers: { regionMode: "any" } });

      expect(screen.getByRole("radio", { name: "Anywhere" })).toBeChecked();
      expect(screen.queryByRole("group", { name: "Where can they run?" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("radio", { name: "Only in…" }));

      expect(onChange).toHaveBeenCalledWith({ regionMode: "only" });
    });

    it("picks the areas they can run in", async () => {
      const { onChange } = setup({ Field: RegionField, answers: { regionMode: "only", areas: ["eu"] } });

      await userEvent.click(screen.getByRole("button", { name: "Asia Pacific" }));

      expect(screen.getByRole("group", { name: "Where can they run?" })).toBeInTheDocument();
      expect(onChange).toHaveBeenCalledWith({ areas: ["eu", "apac"] });
    });

    it("picks the areas they can't run in", () => {
      setup({ Field: RegionField, answers: { regionMode: "except", areas: [] } });

      expect(screen.getByRole("group", { name: "Where can't they run?" })).toBeInTheDocument();
    });

    it("asks for internet speed unless the starting point answered it", async () => {
      const { onChange } = setup({ Field: RegionField, answers: {}, asksUplink: true });

      await userEvent.click(screen.getByRole("radio", { name: "25 Gbps or more" }));

      expect(onChange).toHaveBeenCalledWith({ uplinkGbps: 25 });
    });

    it("leaves out internet speed when the starting point answered it", () => {
      setup({ Field: RegionField, answers: {}, asksUplink: false });

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

  describe(PriceField.name, () => {
    it("keeps only digits and a decimal point in each price", () => {
      const { onChange } = setup({ Field: PriceField, answers: { minUsdPerGpuHour: "1", maxUsdPerGpuHour: "" } });

      fireEvent.change(screen.getByLabelText("Lowest"), { target: { value: "$1.5a" } });
      expect(onChange).toHaveBeenLastCalledWith({ minUsdPerGpuHour: "1.5" });

      fireEvent.change(screen.getByLabelText("Highest"), { target: { value: "3" } });
      expect(onChange).toHaveBeenLastCalledWith({ maxUsdPerGpuHour: "3" });
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

    it("asks for a start date from today on", () => {
      const { onChange } = setup({ Field: TimingField, answers: { start: "date", startDate: "" } });
      const startDate = screen.getByLabelText("Start date");

      fireEvent.change(startDate, { target: { value: "2026-12-01" } });

      expect(startDate).toHaveAttribute("min", "2026-11-04");
      expect(onChange).toHaveBeenCalledWith({ startDate: "2026-12-01" });
    });
  });

  describe(ExtrasField.name, () => {
    it("says the request could grow or that they'd like to talk", async () => {
      const { onChange } = setup({ Field: ExtrasField, answers: { couldGrow: false, wantsToTalk: true } });

      expect(screen.getByRole("checkbox", { name: /I'd like to talk to someone/ })).toBeChecked();

      await userEvent.click(screen.getByRole("checkbox", { name: /This could grow/ }));
      expect(onChange).toHaveBeenLastCalledWith({ couldGrow: true });

      await userEvent.click(screen.getByRole("checkbox", { name: /I'd like to talk to someone/ }));
      expect(onChange).toHaveBeenLastCalledWith({ wantsToTalk: false });
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

  function setup(input: {
    Field: (props: DraftFieldProps & { asksUplink: boolean; today: string }) => ReactNode;
    answers: Partial<GpuQuoteDraft>;
    asksUplink?: boolean;
  }) {
    const onChange = vi.fn();
    render(
      <input.Field
        draft={{ ...createBlankDraft("me@example.com"), ...input.answers }}
        onChange={onChange}
        asksUplink={input.asksUplink ?? true}
        today="2026-11-04"
      />
    );
    return { onChange };
  }
});
