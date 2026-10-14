import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProjectBudget } from "@src/types/project-budget";
import type { DEPENDENCIES } from "./ProjectBudgetDialog";
import { ProjectBudgetDialog } from "./ProjectBudgetDialog";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(ProjectBudgetDialog.name, () => {
  it("sets a first budget with the default alert threshold and top-ups left running", async () => {
    const { createBudget, onClose, enqueueSnackbar } = setup({ budget: null });

    await userEvent.type(screen.getByLabelText("Monthly budget (USD)"), "750.5");
    await userEvent.click(screen.getByRole("button", { name: "Save budget" }));

    expect(createBudget).toHaveBeenCalledWith({ data: { projectId: "storefront", monthlyAmountUsd: 750.5, alertThresholdPercent: 80, stopTopUps: false } });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Saved the budget for storefront" }) }), {
      variant: "success"
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("names what a budget limits and what it does not", () => {
    setup({ budget: null });

    expect(screen.getByRole("heading", { name: "Set a monthly budget" })).toBeInTheDocument();
    expect(screen.getByText(/New deployments in storefront are refused once this month's deposits would pass the budget/)).toBeInTheDocument();
    expect(screen.getByText(/doesn't set money aside for the project or cap what running deployments use/)).toBeInTheDocument();
    expect(screen.getByText(/Running deployments can then run out of funds and close\. Off by default\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove budget" })).not.toBeInTheDocument();
  });

  it("edits the existing budget, opting into stopping top-ups", async () => {
    const { updateBudget, createBudget } = setup({ budget: budget() });

    expect(screen.getByRole("heading", { name: "Edit monthly budget" })).toBeInTheDocument();
    expect(screen.getByLabelText("Monthly budget (USD)")).toHaveValue("500");
    expect(screen.getByLabelText("Alert threshold (%)")).toHaveValue("90");
    expect(screen.getByRole("switch", { name: "Stop top-ups when over budget" })).not.toBeChecked();

    await userEvent.clear(screen.getByLabelText("Alert threshold (%)"));
    await userEvent.type(screen.getByLabelText("Alert threshold (%)"), "75");
    await userEvent.click(screen.getByRole("switch", { name: "Stop top-ups when over budget" }));
    await userEvent.click(screen.getByRole("button", { name: "Save budget" }));

    expect(updateBudget).toHaveBeenCalledWith({ id: "budget-1", data: { monthlyAmountUsd: 500, alertThresholdPercent: 75, stopTopUps: true } });
    expect(createBudget).not.toHaveBeenCalled();
  });

  it("refuses an amount outside the range or finer than a cent", async () => {
    const { createBudget } = setup({ budget: null });
    const amount = screen.getByLabelText("Monthly budget (USD)");

    for (const refused of ["0.99", "10000000.01", "12.345", "abc"]) {
      await userEvent.clear(amount);
      await userEvent.type(amount, refused);
      await userEvent.click(screen.getByRole("button", { name: "Save budget" }));

      expect(amount).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText("Enter an amount from $1.00 to $10,000,000.00, in whole cents.")).toBeInTheDocument();
    }
    expect(createBudget).not.toHaveBeenCalled();
  });

  it("accepts the amounts at both ends of the range", async () => {
    const { createBudget } = setup({ budget: null });
    const amount = screen.getByLabelText("Monthly budget (USD)");

    await userEvent.type(amount, "1");
    await userEvent.click(screen.getByRole("button", { name: "Save budget" }));
    await userEvent.clear(amount);
    await userEvent.type(amount, "10000000");
    await userEvent.click(screen.getByRole("button", { name: "Save budget" }));

    expect(createBudget.mock.calls.map(([{ data }]) => data.monthlyAmountUsd)).toEqual([1, 10_000_000]);
  });

  it("refuses an alert threshold that is not a whole percentage from 1 to 100", async () => {
    const { updateBudget } = setup({ budget: budget() });
    const threshold = screen.getByLabelText("Alert threshold (%)");

    for (const refused of ["0", "101", "50.5", ""]) {
      await userEvent.clear(threshold);
      if (refused) await userEvent.type(threshold, refused);
      await userEvent.click(screen.getByRole("button", { name: "Save budget" }));

      expect(threshold).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText("Enter a whole percentage from 1 to 100.")).toBeInTheDocument();
    }
    expect(updateBudget).not.toHaveBeenCalled();
  });

  it("accepts thresholds of 1 and 100 percent", async () => {
    const { updateBudget } = setup({ budget: budget() });
    const threshold = screen.getByLabelText("Alert threshold (%)");

    await userEvent.clear(threshold);
    await userEvent.type(threshold, "1");
    await userEvent.click(screen.getByRole("button", { name: "Save budget" }));
    await userEvent.clear(threshold);
    await userEvent.type(threshold, "100");
    await userEvent.click(screen.getByRole("button", { name: "Save budget" }));

    expect(updateBudget.mock.calls.map(([{ data }]) => data.alertThresholdPercent)).toEqual([1, 100]);
  });

  it("keeps hints quiet until a save is tried", () => {
    setup({ budget: null });

    expect(screen.getByLabelText("Monthly budget (USD)")).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByText("Counted per calendar month in UTC.")).toBeInTheDocument();
    expect(screen.getByText("Owners and admins get an email once this month's deposits reach this share of the budget.")).toBeInTheDocument();
  });

  it("closes and points at the existing budget when someone set one first", async () => {
    const { createBudget, onClose, enqueueSnackbar } = setup({ budget: null });
    createBudget.mockRejectedValueOnce(new ApiError(409, { code: "project_budget_exists", message: "exists" }, "conflict"));

    await userEvent.type(screen.getByLabelText("Monthly budget (USD)"), "100");
    await userEvent.click(screen.getByRole("button", { name: "Save budget" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "storefront already has a budget" }) }), {
      variant: "warning"
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("says only owners and admins can change budgets when the api refuses the caller", async () => {
    const { updateBudget, onClose, enqueueSnackbar } = setup({ budget: budget() });
    updateBudget.mockRejectedValueOnce(new ApiError(403, { message: "forbidden" }, "forbidden"));

    await userEvent.click(screen.getByRole("button", { name: "Save budget" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        props: expect.objectContaining({ title: "Couldn't save the budget", subTitle: "Only owners and admins can change budgets." })
      }),
      { variant: "error" }
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("asks to try again after any other failure", async () => {
    const { updateBudget, enqueueSnackbar } = setup({ budget: budget() });
    updateBudget.mockRejectedValueOnce(new ApiError(500, {}, "server error"));

    await userEvent.click(screen.getByRole("button", { name: "Save budget" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't save the budget", subTitle: "Try again in a moment." }) }),
      { variant: "error" }
    );
  });

  it("removes the budget", async () => {
    const { deleteBudget, onClose, enqueueSnackbar } = setup({ budget: budget() });

    await userEvent.click(screen.getByRole("button", { name: "Remove budget" }));

    expect(deleteBudget).toHaveBeenCalledWith({ id: "budget-1" });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Removed the budget for storefront" }) }), {
      variant: "success"
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("stays open when the budget cannot be removed", async () => {
    const { deleteBudget, onClose, enqueueSnackbar } = setup({ budget: budget() });
    deleteBudget.mockRejectedValueOnce(new ApiError(500, {}, "server error"));

    await userEvent.click(screen.getByRole("button", { name: "Remove budget" }));

    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ title: "Couldn't remove the budget" }) }), {
      variant: "error"
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on cancel", async () => {
    const { onClose } = setup({ budget: null });

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("holds still while a change is being saved", async () => {
    const { onClose, createBudget, deleteBudget } = setup({ budget: budget(), isPending: true });

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Remove budget/ })).toBeDisabled();
    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    expect(createBudget).not.toHaveBeenCalled();
    expect(deleteBudget).not.toHaveBeenCalled();
  });

  it("closes when dismissed while idle", async () => {
    const { onClose } = setup({ budget: null });

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  function setup(input: { budget: ProjectBudget | null; isPending?: boolean }) {
    const onClose = vi.fn();
    const enqueueSnackbar = vi.fn();
    const createBudget = vi.fn(async (_params: { data: { projectId: string; monthlyAmountUsd: number } }) => ({ data: budget() }));
    const updateBudget = vi.fn(async (_params: { id: string; data: { alertThresholdPercent?: number } }) => ({ data: budget() }));
    const deleteBudget = vi.fn(async (_params: { id: string }) => undefined);
    const isPending = input.isPending ?? false;

    render(
      <ProjectBudgetDialog
        projectId="storefront"
        projectName="storefront"
        budget={input.budget}
        onClose={onClose}
        dependencies={{
          useCreateProjectBudgetMutation: () =>
            mock<ReturnType<typeof DEPENDENCIES.useCreateProjectBudgetMutation>>({ mutateAsync: createBudget, isPending: false }),
          useUpdateProjectBudgetMutation: () => mock<ReturnType<typeof DEPENDENCIES.useUpdateProjectBudgetMutation>>({ mutateAsync: updateBudget, isPending }),
          useDeleteProjectBudgetMutation: () =>
            mock<ReturnType<typeof DEPENDENCIES.useDeleteProjectBudgetMutation>>({ mutateAsync: deleteBudget, isPending: false }),
          useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
        }}
      />
    );

    return { onClose, enqueueSnackbar, createBudget, updateBudget, deleteBudget };
  }

  function budget(): ProjectBudget {
    return {
      id: "budget-1",
      projectId: "storefront",
      monthlyAmountUsd: 500,
      alertThresholdPercent: 90,
      stopTopUps: false,
      currentPeriod: { startDate: "2026-03-01", endDate: "2026-03-31", committedUsd: 120 },
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z"
    };
  }
});
