import React from "react";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ChildrenProps as AlertsListChildrenProps } from "@src/components/alerts/AlertsListContainer/AlertsListContainer";
import type { ChildrenProps as NotificationChannelsListChildrenProps } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import { AlertsPage, DEPENDENCIES } from "./AlertsPage";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(AlertsPage.name, () => {
  it("opens on the alerts tab without the add channel action", () => {
    setup();

    expect(screen.getByRole("tab", { name: "Alerts", selected: true })).toBeInTheDocument();
    expect(screen.getByText("alerts list")).toBeInTheDocument();
    expect(screen.queryByText("channels list")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add channel" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("notification-channel-dialog")).not.toBeInTheDocument();
  });

  it("shows the channels and the add channel action on the channels tab", async () => {
    setup();

    await userEvent.click(screen.getByRole("tab", { name: "Notification Channels" }));

    expect(screen.getByText("channels list")).toBeInTheDocument();
    expect(screen.queryByText("alerts list")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add channel" })).toBeInTheDocument();
  });

  it("adds a channel in a dialog", async () => {
    const { NotificationChannelDialog } = setup();

    await userEvent.click(screen.getByRole("tab", { name: "Notification Channels" }));
    await userEvent.click(screen.getByRole("button", { name: "Add channel" }));

    expect(screen.getByTestId("notification-channel-dialog")).toBeInTheDocument();
    expect(NotificationChannelDialog.mock.lastCall?.[0].notificationChannel).toBeUndefined();

    await userEvent.click(screen.getByRole("button", { name: "Close channel dialog" }));

    expect(screen.queryByTestId("notification-channel-dialog")).not.toBeInTheDocument();
  });

  function setup() {
    const NotificationChannelDialog = vi.fn<typeof DEPENDENCIES.NotificationChannelDialog>(({ onClose }) => (
      <div data-testid="notification-channel-dialog">
        <button onClick={onClose}>Close channel dialog</button>
      </div>
    ));
    const dependencies: typeof DEPENDENCIES = {
      ...DEPENDENCIES,
      Layout: ({ children }) => <>{children}</>,
      SettingsLayout: ({ headerActions, children }) => (
        <>
          {headerActions}
          {children}
        </>
      ),
      AlertsListContainer: ({ children }) => <>{children(mock<AlertsListChildrenProps>())}</>,
      AlertsListView: () => <p>alerts list</p>,
      NotificationChannelsListContainer: ({ children }) => <>{children(mock<NotificationChannelsListChildrenProps>())}</>,
      NotificationChannelsListView: () => <p>channels list</p>,
      NotificationChannelDialog
    };

    render(<AlertsPage dependencies={dependencies} />);

    return { NotificationChannelDialog };
  }
});
