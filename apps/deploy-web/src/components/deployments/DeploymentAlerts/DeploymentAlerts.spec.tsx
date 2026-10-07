import { useFormContext } from "react-hook-form";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import type { ChildrenProps } from "@src/components/alerts/DeploymentAlertsContainer/DeploymentAlertsContainer";
import type { PanelProps, Props } from "@src/components/deployments/DeploymentAlerts/DeploymentAlerts";
import { DEPENDENCIES, DeploymentAlertsPanel, DeploymentAlertsView } from "@src/components/deployments/DeploymentAlerts/DeploymentAlerts";

import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildDeploymentAlert } from "@tests/seeders/deploymentAlert";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";
import { MockComponents } from "@tests/unit/mocks";

describe(DeploymentAlertsView.name, () => {
  it("does not render escrow-balance fields", () => {
    setup();

    expect(screen.queryByText("Escrow Balance")).not.toBeInTheDocument();
    expect(screen.queryByText("Deployment Balance")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: /threshold/i })).not.toBeInTheDocument();
  });

  it("groups the alert types and recipients under their own headings", () => {
    setup();

    expect(screen.getByRole("heading", { level: 3, name: "Types" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Recipients" })).toBeInTheDocument();
  });

  it("handles form submission with updated closed-alert settings", async () => {
    const { componentProps } = setup();

    fireEvent.click(screen.getByRole("checkbox", { name: "Deployment Closed" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Notification channel" }), {
      target: { value: componentProps.notificationChannels[0].id }
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });

    expect(componentProps.upsert).toHaveBeenCalledWith({
      alerts: {
        deploymentClosed: expect.objectContaining({
          enabled: false,
          notificationChannelId: componentProps.notificationChannels[0].id
        })
      }
    });
  });

  it("returns to a clean state with the saved values after a save", async () => {
    const { componentProps } = setup({
      upsertResult: buildDeploymentAlert({
        alerts: { deploymentClosed: { id: faker.string.uuid(), status: "NORMAL", notificationChannelId: faker.string.uuid(), enabled: false } }
      })
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Deployment Closed" }));
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });

    expect(componentProps.upsert).toHaveBeenCalled();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Deployment Closed" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("keeps the unsaved edits when the save fails", async () => {
    setup({ upsertResult: undefined });

    fireEvent.click(screen.getByRole("checkbox", { name: "Deployment Closed" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });

    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Deployment Closed" })).not.toBeChecked();
  });

  it("starts from the saved closed-alert settings", () => {
    const { componentProps } = setup();

    expect(screen.getByRole("checkbox", { name: "Deployment Closed" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Notification channel" })).toHaveValue(componentProps.notificationChannels[1].id);
  });

  it("defaults a deployment without alerts to its first channel, alert off", () => {
    const { componentProps } = setup({ data: undefined });

    expect(screen.getByRole("checkbox", { name: "Deployment Closed" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Notification channel" })).toHaveValue(componentProps.notificationChannels[0].id);
  });

  it("lists the selected channel's addresses as the recipients", () => {
    const { componentProps } = setup();

    expect(screen.getByText("ops@example.com, oncall@example.com")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Notification channel" }), {
      target: { value: componentProps.notificationChannels[0].id }
    });

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.queryByText("ops@example.com, oncall@example.com")).not.toBeInTheDocument();
  });

  it("lists no recipients when no channel is selected", () => {
    setup({ data: undefined });

    fireEvent.change(screen.getByRole("combobox", { name: "Notification channel" }), { target: { value: "" } });

    expect(screen.queryByText(/sends to/i)).not.toBeInTheDocument();
  });

  it("hides the channel select's own label, since the recipients heading names it", () => {
    const { dependencies } = setup();

    expect(dependencies.NotificationChannelSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "deploymentClosed.notificationChannelId", isLabelHidden: true }),
      expect.anything()
    );
  });

  it("stops flagging unsaved changes once the deployment is closed", () => {
    const { componentProps, rerender } = setup({ data: undefined });

    fireEvent.click(screen.getByRole("checkbox", { name: "Deployment Closed" }));
    expect(componentProps.onStateChange).toHaveBeenCalledWith({ hasChanges: true });

    rerender({ disabled: true });

    expect(componentProps.onStateChange).toHaveBeenLastCalledWith({ hasChanges: false });
  });

  it("keeps the save button disabled until a field changes", () => {
    setup();

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Deployment Closed" }));

    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("disables the save button while a save is in flight", () => {
    setup({ isSaving: true });

    fireEvent.click(screen.getByRole("checkbox", { name: "Deployment Closed" }));

    expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
  });

  it("blocks saving an enabled closed alert with no notification channel", async () => {
    const { componentProps } = setup({ data: undefined });

    fireEvent.click(screen.getByRole("checkbox", { name: "Deployment Closed" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Notification channel" }), { target: { value: "" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });

    expect(componentProps.upsert).not.toHaveBeenCalled();
  });

  it("locks the controls and explains why on a closed deployment", () => {
    setup({ disabled: true });

    expect(screen.getByRole("checkbox", { name: "Deployment Closed" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Notification channel" })).toBeDisabled();
    expect(screen.getByText("Alerts can't be changed once a deployment is closed.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("locks the controls while the alerts are loading", () => {
    setup({ isLoading: true });

    expect(screen.getByRole("checkbox", { name: "Deployment Closed" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Notification channel" })).toBeDisabled();
    expect(screen.queryByText("Alerts can't be changed once a deployment is closed.")).not.toBeInTheDocument();
  });

  it("leaves the controls editable on an active deployment", () => {
    setup();

    expect(screen.getByRole("checkbox", { name: "Deployment Closed" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Notification channel" })).toBeEnabled();
  });

  it("hides the deployment closed alert when its flag is off", () => {
    setup({ isClosedAlertFlagOn: false });

    expect(screen.queryByRole("checkbox", { name: "Deployment Closed" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Notification channel" })).toBeInTheDocument();
  });

  function setup(
    input: {
      data?: ChildrenProps["data"];
      disabled?: boolean;
      isSaving?: boolean;
      isLoading?: boolean;
      isClosedAlertFlagOn?: boolean;
      upsertResult?: ChildrenProps["data"];
    } = {}
  ) {
    const notificationChannels = [
      buildNotificationChannel({ config: { addresses: ["alice@example.com"] } }),
      buildNotificationChannel({ config: { addresses: ["ops@example.com", "oncall@example.com"] } })
    ];
    const dependencies = MockComponents(DEPENDENCIES, {
      useFlag: () => input.isClosedAlertFlagOn ?? true,
      DeploymentCloseAlert: ({ disabled }) => {
        const { register } = useFormContext();
        return <input type="checkbox" {...register("deploymentClosed.enabled")} aria-label="Deployment Closed" disabled={disabled} />;
      },
      NotificationChannelSelect: vi.fn(({ name, disabled }) => {
        const { register } = useFormContext();
        return (
          <select {...register(name)} aria-label="Notification channel" disabled={disabled}>
            <option value="">None</option>
            {notificationChannels.map(channel => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
        );
      })
    });

    const componentProps = {
      onStateChange: vi.fn(),
      notificationChannels,
      upsert: vi.fn().mockResolvedValue("upsertResult" in input ? input.upsertResult : undefined),
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
                  notificationChannelId: notificationChannels[1].id,
                  enabled: true
                }
              }
            }),
      isFetched: true,
      isLoading: input.isLoading ?? false,
      isError: false,
      refetch: vi.fn()
    } satisfies Omit<ChildrenProps & Props, "dependencies">;

    const view = render(<DeploymentAlertsView {...componentProps} dependencies={dependencies} />);

    const rerender = (next: { disabled?: boolean }) =>
      view.rerender(<DeploymentAlertsView {...componentProps} disabled={next.disabled ?? componentProps.disabled} dependencies={dependencies} />);

    return { componentProps, dependencies, rerender };
  }
});

describe(DeploymentAlertsPanel.name, () => {
  it("shows a loading skeleton while the channels load", () => {
    setup({ channels: { isFetched: false } });

    expect(screen.getByRole("status", { name: "Loading alerts" })).toBeInTheDocument();
    expect(screen.queryByText("alerts-form")).not.toBeInTheDocument();
  });

  it("shows a loading skeleton while the deployment's alerts load", () => {
    setup({ alerts: { isFetched: false } });

    expect(screen.getByRole("status", { name: "Loading alerts" })).toBeInTheDocument();
    expect(screen.queryByText("alerts-form")).not.toBeInTheDocument();
  });

  it("offers a retry when the channels fail to load", async () => {
    const { channels, alerts } = setup({ channels: { isError: true, data: [] } });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this deployment's alerts");
    expect(screen.queryByRole("status", { name: "Loading alerts" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(channels.refetch).toHaveBeenCalled();
    expect(alerts.refetch).toHaveBeenCalled();
  });

  it("offers a retry when the deployment's alerts fail to load", () => {
    setup({ alerts: { isError: true, data: undefined } });

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load this deployment's alerts");
    expect(screen.queryByText("alerts-form")).not.toBeInTheDocument();
  });

  it("keeps the form when a background refetch fails but data is cached", () => {
    setup({ channels: { isError: true }, alerts: { isError: true } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("alerts-form")).toBeInTheDocument();
  });

  it("asks for a notification channel when there is none", () => {
    const { dependencies } = setup({ channels: { data: [] } });

    expect(screen.getByText("No notification channel yet")).toBeInTheDocument();
    expect(dependencies.AccountEmailChannelCreator).toHaveBeenCalled();
    expect(screen.queryByText("alerts-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("notification-channel-dialog")).not.toBeInTheDocument();
  });

  it("adds a notification channel in a dialog without leaving the page", async () => {
    setup({ channels: { data: [] } });

    await userEvent.click(screen.getByRole("button", { name: "Add notification channel" }));

    expect(screen.getByTestId("notification-channel-dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close channel dialog" }));

    expect(screen.queryByTestId("notification-channel-dialog")).not.toBeInTheDocument();
  });

  it("shows the locked form instead of the channel prompt on a closed deployment", () => {
    setup({ channels: { data: [] }, isDeploymentClosed: true });

    expect(screen.queryByText("No notification channel yet")).not.toBeInTheDocument();
    expect(screen.getByText("Alerts can't be changed once a deployment is closed.")).toBeInTheDocument();
  });

  it("shows the form once channels and alerts have loaded", () => {
    setup();

    expect(screen.getByText("alerts-form")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading alerts" })).not.toBeInTheDocument();
  });

  function setup(
    input: {
      channels?: Partial<PanelProps["channels"]>;
      alerts?: Partial<ChildrenProps>;
      isDeploymentClosed?: boolean;
    } = {}
  ) {
    const dependencies = MockComponents(DEPENDENCIES, {
      useFlag: () => true,
      DeploymentCloseAlert: () => <div>alerts-form</div>,
      NotificationChannelSelect: () => null,
      NotificationChannelDialog: ({ onClose }) => (
        <div data-testid="notification-channel-dialog">
          <button onClick={onClose}>Close channel dialog</button>
        </div>
      )
    });
    const channels: PanelProps["channels"] = {
      data: [buildNotificationChannel()],
      isFetched: true,
      isError: false,
      refetch: vi.fn(),
      ...input.channels
    };
    const alerts: ChildrenProps = {
      data: buildDeploymentAlert(),
      upsert: vi.fn(),
      isLoading: false,
      isSaving: false,
      isFetched: true,
      isError: false,
      refetch: vi.fn(),
      ...input.alerts
    };

    render(<DeploymentAlertsPanel channels={channels} alerts={alerts} isDeploymentClosed={input.isDeploymentClosed ?? false} dependencies={dependencies} />);

    return { channels, alerts, dependencies };
  }
});
