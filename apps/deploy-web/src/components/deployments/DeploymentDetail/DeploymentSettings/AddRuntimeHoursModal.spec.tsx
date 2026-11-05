import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { MAX_RUNTIME_LIMIT_HOURS } from "@src/utils/runtimeLimitUtils";
import type { DEPENDENCIES } from "./AddRuntimeHoursModal";
import { AddRuntimeHoursModal } from "./AddRuntimeHoursModal";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(AddRuntimeHoursModal.name, () => {
  it("submits the new total rather than the added hours", async () => {
    const { onSubmit } = setup({ currentLimitHours: 12 });

    fireEvent.change(screen.getByLabelText("Hours to add"), { target: { value: "6" } });
    await userEvent.click(screen.getByRole("button", { name: "Add hours" }));

    expect(onSubmit).toHaveBeenCalledWith(18);
  });

  it("shows the resulting limit as the user types", () => {
    setup({ currentLimitHours: 12 });

    fireEvent.change(screen.getByLabelText("Hours to add"), { target: { value: "6" } });

    expect(screen.getByText("18h")).toBeInTheDocument();
  });

  it("quotes the added hours off the API's blocks per hour", () => {
    setup({ currentLimitHours: 12, costPerBlockUdenom: 150 });

    fireEvent.change(screen.getByLabelText("Hours to add"), { target: { value: "2" } });

    expect(screen.getByText("$0.18")).toBeInTheDocument();
  });

  it("caps the added hours at one increment", () => {
    setup({ currentLimitHours: 12 });

    fireEvent.change(screen.getByLabelText("Hours to add"), { target: { value: "999" } });

    expect(screen.getByLabelText("Hours to add")).toHaveValue(48);
  });

  it("caps the added hours so the total stays within the overall limit", () => {
    setup({ currentLimitHours: 8750 });

    fireEvent.change(screen.getByLabelText("Hours to add"), { target: { value: "48" } });

    expect(screen.getByLabelText("Hours to add")).toHaveValue(10);
  });

  it("caps the added hours at a trial's ceiling", () => {
    setup({ currentLimitHours: 12, maxLimitHours: 24 });

    fireEvent.change(screen.getByLabelText("Hours to add"), { target: { value: "48" } });

    expect(screen.getByLabelText("Hours to add")).toHaveValue(12);
    expect(screen.getByText("This deployment closes automatically after 12h. Add up to 12 more hours now.")).toBeInTheDocument();
  });

  it("invites adding more later while the ceiling is beyond this extension", () => {
    setup({ currentLimitHours: 12 });

    expect(screen.getByText("This deployment closes automatically after 12h. Add up to 48 more hours now, and add more again later.")).toBeInTheDocument();
  });

  it("blocks submission when no hours are added", async () => {
    const { onSubmit } = setup({ currentLimitHours: 12 });

    fireEvent.change(screen.getByLabelText("Hours to add"), { target: { value: "0" } });
    await userEvent.click(screen.getByRole("button", { name: "Add hours" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submission while a previous request is in flight", async () => {
    const { onSubmit } = setup({ currentLimitHours: 12, isSubmitting: true });

    await userEvent.click(screen.getByRole("button", { name: "Add hours" }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cancels with onCancel", async () => {
    const { onCancel } = setup({ currentLimitHours: 12 });

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
  });

  function setup(input: { currentLimitHours: number; maxLimitHours?: number; costPerBlockUdenom?: number; isSubmitting?: boolean }) {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const usePricing: typeof DEPENDENCIES.usePricing = () =>
      mock<ReturnType<typeof DEPENDENCIES.usePricing>>({ udenomToUsd: (amount: string | number) => Number(amount) / 1_000_000 });

    render(
      <AddRuntimeHoursModal
        currentLimitHours={input.currentLimitHours}
        maxLimitHours={input.maxLimitHours ?? MAX_RUNTIME_LIMIT_HOURS}
        costPerBlockUdenom={input.costPerBlockUdenom ?? 100}
        denom="uact"
        isSubmitting={input.isSubmitting}
        onSubmit={onSubmit}
        onCancel={onCancel}
        dependencies={{ usePricing }}
      />
    );

    return { onSubmit, onCancel };
  }
});
