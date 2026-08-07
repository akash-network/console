import { useFormContext } from "react-hook-form";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import type { ChildrenProps } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import type { Props as DeploymentAlertsViewProps } from "@src/components/deployments/DeploymentAlerts/DeploymentAlerts";
import { DeploymentAlertsView } from "@src/components/deployments/DeploymentAlerts/DeploymentAlerts";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { buildDeploymentAlert } from "@tests/seeders/deploymentAlert";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";

describe("DeploymentAlerts", () => {
  it("should handle form submission with updated alert settings", async () => {
    const { componentProps } = setup();

    fireEvent.click(screen.getByLabelText("Enabled", { selector: '[name="deploymentBalance.enabled"]' }));
    fireEvent.click(screen.getByLabelText("Enabled", { selector: '[name="deploymentClosed.enabled"]' }));

    fireEvent.change(screen.getByRole("combobox", { name: /escrow balance notification channel/i }), {
      target: { value: componentProps.notificationChannels[0].id }
    });
    fireEvent.change(screen.getByRole("combobox", { name: /deployment close notification channel/i }), {
      target: { value: componentProps.notificationChannels[1].id }
    });

    fireEvent.change(screen.getByRole("spinbutton", { name: /threshold/i }), { target: { value: "100" } });

    const saveButton = screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement;

    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(componentProps.upsert).toHaveBeenCalledWith({
      alerts: {
        deploymentBalance: expect.objectContaining({
          enabled: false,
          notificationChannelId: componentProps.notificationChannels[0].id,
          threshold: 100
        }),
        deploymentClosed: expect.objectContaining({
          enabled: false,
          notificationChannelId: componentProps.notificationChannels[1].id
        })
      }
    });
  });

  it("only persists the edited section when the escrow balance has drifted", async () => {
    const { componentProps, rerender } = setup({ data: undefined, maxBalanceThreshold: 1000 });

    rerender({ maxBalanceThreshold: 500 });

    fireEvent.click(screen.getByLabelText("Enabled", { selector: '[name="deploymentClosed.enabled"]' }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    });

    expect(componentProps.upsert).toHaveBeenCalledWith({
      alerts: { deploymentClosed: expect.objectContaining({ enabled: true }) }
    });
  });

  it("does not flag unsaved changes when the escrow balance drops on close", () => {
    const { componentProps, rerender } = setup({ data: undefined, maxBalanceThreshold: 1000 });

    rerender({ maxBalanceThreshold: 0, disabled: true });

    expect(componentProps.onStateChange).not.toHaveBeenCalledWith({ hasChanges: true });
  });

  it("stops flagging unsaved changes once the deployment is closed", () => {
    const { componentProps, rerender } = setup({ data: undefined });

    fireEvent.click(screen.getByLabelText("Enabled", { selector: '[name="deploymentBalance.enabled"]' }));
    expect(componentProps.onStateChange).toHaveBeenCalledWith({ hasChanges: true });

    rerender({ disabled: true });

    expect(componentProps.onStateChange).toHaveBeenLastCalledWith({ hasChanges: false });
  });

  it("keeps the save button disabled until a field changes", () => {
    setup();

    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("Enabled", { selector: '[name="deploymentBalance.enabled"]' }));

    expect((screen.getByRole("button", { name: /save changes/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  function setup(input: { data?: ChildrenProps["data"]; maxBalanceThreshold?: number; disabled?: boolean } = {}) {
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
              <option value={channel1Id}>Channel 1</option>
              <option value={channel2Id}>Channel 2</option>
            </select>
          </div>
        );
      },
      DeploymentBalanceAlert: ({ disabled }: { disabled?: boolean }) => {
        const { register } = useFormContext();
        return (
          <div>
            <input type="checkbox" {...register("deploymentBalance.enabled")} aria-label="Enabled" disabled={disabled} />
            <select {...register("deploymentBalance.notificationChannelId")} aria-label="Escrow Balance Notification Channel" disabled={disabled}>
              <option value={channel1Id}>Channel 1</option>
              <option value={channel2Id}>Channel 2</option>
            </select>
            <input type="number" {...register("deploymentBalance.threshold", { valueAsNumber: true })} aria-label="Threshold" disabled={disabled} />
          </div>
        );
      }
    };

    const componentProps: Omit<ChildrenProps & DeploymentAlertsViewProps, "deployment"> = {
      maxBalanceThreshold: input.maxBalanceThreshold ?? 1000,
      onStateChange: vi.fn(),
      notificationChannels: [buildNotificationChannel({ id: channel1Id }), buildNotificationChannel({ id: channel2Id })],
      upsert: vi.fn(),
      disabled: input.disabled,
      data:
        "data" in input
          ? input.data
          : buildDeploymentAlert({
              alerts: {
                deploymentBalance: {
                  id: faker.string.uuid(),
                  status: "NORMAL",
                  notificationChannelId: channel1Id,
                  threshold: 100,
                  enabled: true
                },
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

    const rerender = (next: { maxBalanceThreshold?: number; disabled?: boolean }) =>
      view.rerender(
        <DeploymentAlertsView
          {...componentProps}
          maxBalanceThreshold={next.maxBalanceThreshold ?? componentProps.maxBalanceThreshold}
          disabled={next.disabled ?? componentProps.disabled}
          dependencies={DEPENDENCIES}
        />
      );

    return { componentProps, rerender };
  }
});
