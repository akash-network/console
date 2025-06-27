import { useFormContext } from "react-hook-form";
import { faker } from "@faker-js/faker";

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
        deploymentBalance: {
          enabled: false,
          notificationChannelId: componentProps.notificationChannels[0].id,
          threshold: 100
        },
        deploymentClosed: {
          enabled: false,
          notificationChannelId: componentProps.notificationChannels[1].id
        }
      }
    });
  });

  function setup() {
    const channel1Id = faker.string.uuid();
    const channel2Id = faker.string.uuid();

    const COMPONENTS = {
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
      maxBalanceThreshold: 1000,
      onStateChange: jest.fn(),
      notificationChannels: [buildNotificationChannel({ id: channel1Id }), buildNotificationChannel({ id: channel2Id })],
      upsert: jest.fn(),
      data: buildDeploymentAlert({
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

    render(<DeploymentAlertsView {...componentProps} components={COMPONENTS} />);

    return { componentProps };
  }
});
