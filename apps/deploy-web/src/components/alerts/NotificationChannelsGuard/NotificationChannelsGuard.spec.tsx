import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import type { Props } from "./NotificationChannelsGuard";
import { NotificationChannelsGuardView } from "./NotificationChannelsGuard";

import { render, screen } from "@testing-library/react";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";

describe("NotificationChannelsGuardView", () => {
  it("renders loading blocker when not fetched", () => {
    setup();
    expect(screen.getByTestId("loading-blocker")).toBeInTheDocument();
  });

  it("renders message and link when no notification channels", () => {
    setup({ isFetched: true });
    expect(screen.getByText("To start using alerting you need to add at least one notification channel")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add notification channel/i })).toBeInTheDocument();
  });

  it("renders children when notification channels exist", async () => {
    const { childTestId } = setup({ data: [buildNotificationChannel()], isFetched: true });
    await vi.waitFor(() => {
      expect(screen.getByTestId(childTestId)).toBeInTheDocument();
    });
  });

  function setup(providedProps: Partial<Props> = {}) {
    const props = {
      isFetched: false,
      data: [],
      components: {
        AccountEmailChannelCreator: () => <></>
      },
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
