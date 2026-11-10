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

    it("marks picked areas with a check to run in and a ban to leave out", () => {
      const { rerender } = setup({ Field: RegionField, answers: { regionMode: "only", areas: ["eu"] } });
      expect(screen.getByRole("button", { name: "Europe" }).querySelector(".lucide-check")).toBeInTheDocument();

      rerender({ regionMode: "except" });
      expect(screen.getByRole("button", { name: "Europe" }).querySelector(".lucide-ban")).toBeInTheDocument();
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
      expect(screen.queryByText(/Very few providers offer 99.9%/)).not.toBeInTheDocument();
    });

    it("marks 99.9% as rare and warns when it is picked", () => {
      setup({ Field: SlaField, answers: { sla: "99.9" } });

      expect(screen.getByRole("radio", { name: "99.9% Rare Up to 44 min down a month" })).toBeChecked();
      expect(screen.getByText(/Very few providers offer 99.9%/)).toBeInTheDocument();
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

      expect(
        within(screen.getByRole("group", { name: "Term" }))
          .getAllByRole("radio")
          .map(term => term.textContent)
      ).toEqual(["Month to month", "6 months", "1 year", "2 years or more"]);
    });

    it("takes a typed start date once it is a real day from today on", async () => {
      const { onChange } = setup({ Field: TimingField, answers: { start: "date", startDate: "" } });
      const startDate = screen.getByLabelText("Start date");

      await userEvent.type(startDate, "12/01/202");
      expect(onChange).not.toHaveBeenCalled();

      await userEvent.type(startDate, "6");
      expect(onChange).toHaveBeenLastCalledWith({ startDate: "2026-12-01" });
    });

    it.each(["02/30/2027", "11/03/2026", "soon"])("flags %s when the field is left", async typed => {
      const { onChange } = setup({ Field: TimingField, answers: { start: "date", startDate: "" } });
      const startDate = screen.getByLabelText("Start date");

      await userEvent.type(startDate, typed);
      await userEvent.tab();

      expect(startDate).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText("Enter a date from today onward, like 11/04/2026.")).toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("clears the start date when a valid date is edited into an invalid one", async () => {
      const { onChange } = setup({ Field: TimingField, answers: { start: "date", startDate: "2026-12-01" } });
      const startDate = screen.getByLabelText("Start date");

      await userEvent.type(startDate, "{backspace}");
      await userEvent.tab();

      expect(startDate).toHaveAttribute("aria-invalid", "true");
      expect(onChange).toHaveBeenLastCalledWith({ startDate: "" });
    });

    it("clears the start date when the typed date is erased, and accepts one typed with dashes", async () => {
      const { onChange } = setup({ Field: TimingField, answers: { start: "date", startDate: "2026-12-01" } });
      const startDate = screen.getByLabelText("Start date");

      expect(startDate).toHaveValue("12/01/2026");

      await userEvent.clear(startDate);
      await userEvent.tab();
      expect(onChange).toHaveBeenLastCalledWith({ startDate: "" });

      await userEvent.type(startDate, "1-5-2027");
      await userEvent.tab();
      expect(onChange).toHaveBeenLastCalledWith({ startDate: "2027-01-05" });
      expect(startDate).not.toHaveAttribute("aria-invalid");
    });

    it("picks a start date on the calendar, where earlier days are off", async () => {
      const { onChange } = setup({ Field: TimingField, answers: { start: "date", startDate: "" } });

      expect(screen.getByRole("button", { name: /November 3rd, 2026/ })).toBeDisabled();

      await userEvent.click(screen.getByRole("button", { name: /November 20th, 2026/ }));

      expect(onChange).toHaveBeenLastCalledWith({ startDate: "2026-11-20" });
      expect(screen.getByLabelText("Start date")).toHaveValue("11/20/2026");
    });

    it("clears the start date when the picked day is picked again", async () => {
      const { onChange } = setup({ Field: TimingField, answers: { start: "date", startDate: "2026-11-20" } });

      await userEvent.click(screen.getByRole("button", { name: /November 20th, 2026/ }));

      expect(onChange).toHaveBeenLastCalledWith({ startDate: "" });
      expect(screen.getByLabelText("Start date")).toHaveValue("");
    });
  });

  describe(ContactField.name, () => {
    it("fills in the contact details without asking again for the account's email", () => {
      const { onChange } = setup({ Field: ContactField, answers: {} });

      expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: "+1 555" } });
      expect(onChange).toHaveBeenLastCalledWith({ phone: "+1 555" });

      fireEvent.change(screen.getByLabelText(/Company/), { target: { value: "Acme" } });
      expect(onChange).toHaveBeenLastCalledWith({ company: "Acme" });

      fireEvent.change(screen.getByLabelText(/Anything else/), { target: { value: "Training" } });
      expect(onChange).toHaveBeenLastCalledWith({ notes: "Training" });
    });

    it("asks for an email when the account has none", () => {
      const { onChange } = setup({ Field: ContactField, answers: { email: "" }, asksEmail: true });

      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ops@example.com" } });

      expect(onChange).toHaveBeenLastCalledWith({ email: "ops@example.com" });
    });
  });

  type FieldProps = DraftFieldProps & { today: string; asksEmail: boolean };

  function setup(input: { Field: (props: FieldProps) => ReactNode; answers: Partial<GpuQuoteDraft>; asksEmail?: boolean }) {
    const onChange = vi.fn();
    const draft = { ...createBlankDraft("me@example.com"), ...input.answers };
    const renderField = (answers: Partial<GpuQuoteDraft>) => (
      <input.Field draft={{ ...draft, ...answers }} onChange={onChange} today="2026-11-04" asksEmail={input.asksEmail ?? false} />
    );
    const { rerender } = render(renderField({}));

    return { onChange, rerender: (answers: Partial<GpuQuoteDraft>) => rerender(renderField(answers)) };
  }
});
