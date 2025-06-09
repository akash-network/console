import "@testing-library/jest-dom";

import React from "react";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { PopupProvider } from "@akashnetwork/ui/context";

import type { NotificationChannelsListViewProps } from "./NotificationChannelsListView";
import { NotificationChannelsListView } from "./NotificationChannelsListView";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";

describe("NotificationChannelsListView", () => {
  it("renders loading spinner when isLoading is true", () => {
    setup({ isLoading: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders error message when isError is true", () => {
    setup({ isError: true });
    expect(screen.getByText("Error loading notification channels")).toBeInTheDocument();
  });

  it("renders empty state message when no data is provided", () => {
    setup({ data: [] });
    expect(screen.getByText("No notification channels found")).toBeInTheDocument();
  });

  it("renders table with notification channels data", () => {
    const mockNotificationChannel = buildNotificationChannel();

    setup({ data: [mockNotificationChannel] });

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Addresses")).toBeInTheDocument();

    expect(screen.getByText(mockNotificationChannel.name)).toBeInTheDocument();
    expect(screen.getByText("email")).toBeInTheDocument();
    expect(screen.getByText(mockNotificationChannel.config.addresses[0])).toBeInTheDocument();
  });

  it("shows confirmation popup when remove button is clicked", async () => {
    const mockNotificationChannel = buildNotificationChannel();
    setup({ data: [mockNotificationChannel] });

    fireEvent.click(screen.getByTestId("remove-notification-channel-button"));

    await waitFor(() => {
      expect(screen.getByTestId("remove-notification-channel-confirmation-popup")).toBeInTheDocument();
    });

    expect(screen.getByText("Are you sure you want to remove this notification channel?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("calls onRemove when confirmed", async () => {
    const onRemove = jest.fn();
    const mockNotificationChannel = buildNotificationChannel();

    setup({ data: [mockNotificationChannel], onRemove });

    fireEvent.click(screen.getByTestId("remove-notification-channel-button"));

    await waitFor(() => {
      expect(screen.getByTestId("remove-notification-channel-confirmation-popup")).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(screen.getByTestId("remove-notification-channel-confirmation-popup-confirm-button"));
    });

    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledWith(mockNotificationChannel.id);
    });
  });

  it("does not render pagination when total is not greater than minimum page size", () => {
    setup();

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders pagination when total is greater than minimum page size", () => {
    const pagination = {
      page: 1,
      limit: 10,
      total: 11,
      totalPages: 2
    };
    const mockData = Array.from({ length: 11 }, buildNotificationChannel);

    setup({ data: mockData, pagination });

    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  function setup(props: Partial<NotificationChannelsListViewProps> = {}) {
    const defaultProps: NotificationChannelsListViewProps = {
      pagination: {
        page: 1,
        limit: 10,
        total: 10,
        totalPages: 1
      },
      data: Array.from({ length: 10 }, buildNotificationChannel),
      isLoading: false,
      onRemove: jest.fn(),
      removingIds: new Set(),
      onPaginationChange: jest.fn(),
      isError: false,
      ...props
    };

    render(
      <PopupProvider>
        <TooltipProvider>
          <NotificationChannelsListView {...defaultProps} />
        </TooltipProvider>
      </PopupProvider>
    );
    return defaultProps;
  }
});
