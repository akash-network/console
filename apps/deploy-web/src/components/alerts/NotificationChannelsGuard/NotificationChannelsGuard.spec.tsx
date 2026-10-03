import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import type { COMPONENTS, Props } from "./NotificationChannelsGuard";
import { NotificationChannelsGuardView } from "./NotificationChannelsGuard";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";

describe("NotificationChannelsGuardView", () => {
  it("renders loading blocker when not fetched", () => {
    setup();
    expect(screen.getByTestId("loading-blocker")).toBeInTheDocument();
  });

  it("asks for a notification channel when there is none", () => {
    setup({ isFetched: true });

    expect(screen.getByText("To start using alerting you need to add at least one notification channel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add notification channel" })).toBeInTheDocument();
    expect(screen.queryByTestId("notification-channel-dialog")).not.toBeInTheDocument();
  });

  it("adds a notification channel in a dialog without leaving the page", async () => {
    setup({ isFetched: true });

    await userEvent.click(screen.getByRole("button", { name: "Add notification channel" }));

    expect(screen.getByTestId("notification-channel-dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close channel dialog" }));

    expect(screen.queryByTestId("notification-channel-dialog")).not.toBeInTheDocument();
  });

  it("renders children when notification channels exist", async () => {
    const { childTestId } = setup({ data: [buildNotificationChannel()], isFetched: true });
    await vi.waitFor(() => {
      expect(screen.getByTestId(childTestId)).toBeInTheDocument();
    });
  });

  function setup(providedProps: Partial<Props> = {}) {
    const components: typeof COMPONENTS = {
      AccountEmailChannelCreator: () => <></>,
      NotificationChannelDialog: ({ onClose }) => (
        <div data-testid="notification-channel-dialog">
          <button onClick={onClose}>Close channel dialog</button>
        </div>
      )
    };
    const props = {
      isFetched: false,
      data: [],
      components,
      ...providedProps
    };
    const childTestId = faker.string.uuid();
    const child = <div data-testid={childTestId} />;
    render(<NotificationChannelsGuardView {...props}>{child}</NotificationChannelsGuardView>);

    return {
      childTestId,
      child
    };
  }
});
