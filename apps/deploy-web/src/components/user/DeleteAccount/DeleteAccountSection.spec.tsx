import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AnalyticsService } from "@src/services/analytics/analytics.service";
import { DeleteAccountSection, DEPENDENCIES } from "./DeleteAccountSection";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockComponents } from "@tests/unit/mocks";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(DeleteAccountSection.name, () => {
  it("stays hidden while account deletion is off", () => {
    const { useFlag } = setup({ isEnabled: false });

    expect(screen.queryByRole("button", { name: "Delete account" })).not.toBeInTheDocument();
    expect(useFlag).toHaveBeenCalledWith("account_deletion");
  });

  it("opens the deletion dialog for the user's email and reports it", async () => {
    const { user, DeleteAccountDialog, analyticsService } = setup({ isEnabled: true });
    expect(DeleteAccountDialog).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete account" }));

    expect(DeleteAccountDialog.mock.lastCall?.[0]).toEqual(expect.objectContaining({ email: "jane@example.com" }));
    expect(analyticsService.track).toHaveBeenCalledWith("account_deletion_modal_opened", { category: "user", label: "Open delete account dialog" });
  });

  it("closes the dialog when it asks to", async () => {
    const { user, DeleteAccountDialog } = setup({ isEnabled: true });
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    const renderCount = DeleteAccountDialog.mock.calls.length;

    act(() => DeleteAccountDialog.mock.lastCall?.[0].onClose());

    expect(screen.queryByText("delete account dialog")).not.toBeInTheDocument();
    expect(DeleteAccountDialog.mock.calls.length).toBe(renderCount);
  });

  function setup(input: { isEnabled: boolean }) {
    const analyticsService = mock<AnalyticsService>();
    const useFlag = vi.fn(() => input.isEnabled);
    const DeleteAccountDialog = vi.fn<typeof DEPENDENCIES.DeleteAccountDialog>(() => <div>delete account dialog</div>);

    render(
      <TestContainerProvider services={{ analyticsService: () => analyticsService }}>
        <DeleteAccountSection email="jane@example.com" dependencies={MockComponents(DEPENDENCIES, { useFlag, DeleteAccountDialog })} />
      </TestContainerProvider>
    );

    return { user: userEvent.setup(), useFlag, DeleteAccountDialog, analyticsService };
  }
});
