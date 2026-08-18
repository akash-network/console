import React from "react";
import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES, EditNotificationChannelPage } from "./EditNotificationChannelPage";

import { render, screen } from "@testing-library/react";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";
import { MockComponents } from "@tests/unit/mocks";

describe(EditNotificationChannelPage.name, () => {
  it("points the header back arrow at the alerts page", () => {
    setup();

    expect(screen.getByRole("link")).toHaveAttribute("href", "/alerts");
  });

  function setup() {
    const notificationChannel = buildNotificationChannel();
    const dependencies = MockComponents(DEPENDENCIES, {
      useBackNav: () => vi.fn(),
      useNavigationGuard: () => ({ toggle: vi.fn() }),
      NotificationChannelEditContainer: () => <div data-testid="notification-channel-edit-container" />
    });

    render(<EditNotificationChannelPage notificationChannel={notificationChannel} dependencies={dependencies} />);

    return { notificationChannel };
  }
});
