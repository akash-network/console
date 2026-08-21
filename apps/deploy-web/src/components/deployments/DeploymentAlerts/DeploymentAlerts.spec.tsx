import { useFormContext } from "react-hook-form";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import type { ChildrenProps } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import type { Props as DeploymentAlertsViewProps } from "@src/components/deployments/DeploymentAlerts/DeploymentAlerts";
import { DeploymentAlertsView } from "@src/components/deployments/DeploymentAlerts/DeploymentAlerts";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { buildDeploymentAlert } from "@tests/seeders/deploymentAlert";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";

describe(DeploymentAlertsView.name, () => {
  it("does not render escrow-balance fields", () => {
    setup();

    expect(screen.queryByText("Escrow Balance")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: /threshold/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /escrow balance notification channel/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Enabled", { selector: '[name="deploymentBalance.enabled"]' })).not.toBeInTheDocument();
  });

  it("handles form submission with updated closed-alert settings", async () => {
    const { componentProps } = setup();

    fireEvent.click(screen.getByLabelText("Enabled", { selector: '[name="deploymentClosed.enabled"]' }));
    fireEvent.change(screen.getByRole("combobox", { name: /deployment close notification channel/i }), {
      target: { value: componentProps.notificationChannels[1].id }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    expect(componentProps.upsert).toHaveBeenCalledWith({
      alerts: {
        deploymentClosed: expect.objectContaining({
          enabled: false,
          notificationChannelId: componentProps.notificationChannels[1].id
        })
      }
    });
  });

  it("stops flagging unsaved changes once the deployment is closed", () => {
    const { componentProps, rerender } = setup({ data: undefined });

    fireEvent.click(screen.getByLabelText("Enabled", { selector: '[name="deploymentClosed.enabled"]' }));
    expect(componentProps.onStateChange).toHaveBeenCalledWith({ hasChanges: true });

    rerender({ disabled: true });

    expect(componentProps.onStateChange).toHaveBeenLastCalledWith({ hasChanges: false });
  });

  it("keeps the save button disabled until a field changes", () => {
    setup();

    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("Enabled", { selector: '[name="deploymentClosed.enabled"]' }));

    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables the save button while a save is in flight", () => {
    setup({ isSaving: true });

    fireEvent.click(screen.getByLabelText("Enabled", { selector: '[name="deploymentClosed.enabled"]' }));

    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("blocks saving an enabled closed alert with no notification channel", async () => {
    const { componentProps } = setup({ data: undefined });

    fireEvent.click(screen.getByLabelText("Enabled", { selector: '[name="deploymentClosed.enabled"]' }));
    fireEvent.change(screen.getByRole("combobox", { name: /deployment close notification channel/i }), { target: { value: "" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    expect(componentProps.upsert).not.toHaveBeenCalled();
  });

  function setup(input: { data?: ChildrenProps["data"]; disabled?: boolean; isSaving?: boolean } = {}) {
    const channel1Id = faker.string.uuid();
    const channel2Id = faker.string.uuid();

    const DEPENDENCIES = {
      useFlag: () => true,
      DeploymentCloseAlert: ({ disabled }: { disabled?: boolean }) => {
        const { register } = useFormContext();
        return (
          <div>
            <input type="checkbox" {...register("deploymentClosed.enabled")} aria-label="Enabled" disabled={disabled} />
            <select {...register("deploymentClosed.notificationChannelId")} aria-label="Deployment Close Notification Channel" disabled={disabled}>
              <option value="">None</option>
              <option value={channel1Id}>Channel 1</option>
              <option value={channel2Id}>Channel 2</option>
            </select>
          </div>
        );
      }
    };

    const componentProps: Omit<ChildrenProps & DeploymentAlertsViewProps, "deployment"> = {
      onStateChange: vi.fn(),
      notificationChannels: [buildNotificationChannel({ id: channel1Id }), buildNotificationChannel({ id: channel2Id })],
      upsert: vi.fn(),
      disabled: input.disabled,
      isSaving: input.isSaving ?? false,
      data:
        "data" in input
          ? input.data
          : buildDeploymentAlert({
              alerts: {
                deploymentClosed: {
                  id: faker.string.uuid(),
                  status: "NORMAL",
                  notificationChannelId: channel2Id,
                  enabled: true
                }
              }
            }),
      isFetched: true,
      isLoading: false,
      isError: false
    };

    const view = render(<DeploymentAlertsView {...componentProps} dependencies={DEPENDENCIES} />);

    const rerender = (next: { disabled?: boolean }) =>
      view.rerender(<DeploymentAlertsView {...componentProps} disabled={next.disabled ?? componentProps.disabled} dependencies={DEPENDENCIES} />);

    return { componentProps, rerender };
  }
});
