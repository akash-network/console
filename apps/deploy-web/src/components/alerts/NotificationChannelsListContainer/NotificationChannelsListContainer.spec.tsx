import React from "react";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { describe, expect, it, vi } from "vitest";

import { NotificationChannelsListContainer } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import type { NotificationChannelsListViewProps } from "@src/components/alerts/NotificationChannelsListView/NotificationChannelsListView";
import { queryClient } from "@src/queries";
import { createApiSdk } from "@src/services/api-sdk/createApiSdk";

import { act, render, screen } from "@testing-library/react";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";
import { jsonResponse } from "@tests/unit/jsonResponse";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("NotificationChannelsListContainer", () => {
  it("renders notification channels list with data", async () => {
    const { mockData, child } = await setup();
    expect(child.data).toEqual(mockData.data);
  });

  it("calls delete endpoint and shows success notification when removing a notification channel succeeds", async () => {
    const { mockData, mockFetch, child } = await setup();
    const result = await act(() => child.onRemove(mockData.data[0].id));

    expect(result).toBe("removed");

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/notification-channels/${mockData.data[0].id}`),
        expect.objectContaining({ method: "DELETE" })
      );
      expect(screen.getByTestId("notification-channel-remove-success-notification")).toBeInTheDocument();
    });
  });

  it("calls delete endpoint and shows error notification when removing a notification channel fails", async () => {
    const { mockData, mockFetch, child } = await setup();
    mockFetch.mockRejectedValue(new Error());
    const result = await act(() => child.onRemove(mockData.data[0].id));

    expect(result).toBe("failed");

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/v1/notification-channels/${mockData.data[0].id}`),
        expect.objectContaining({ method: "DELETE" })
      );
      expect(screen.getByTestId("notification-channel-remove-error-notification")).toBeInTheDocument();
    });
  });

  it("reports a channel that alerts still use without showing an error notification", async () => {
    const { mockData, mockFetch, child } = await setup();
    mockFetch.mockResolvedValue(jsonResponse({ statusCode: 400, message: "Cannot delete notification channel with alerts" }, 400));

    const result = await act(() => child.onRemove(mockData.data[0].id));

    expect(result).toBe("in-use");
    expect(screen.queryByTestId("notification-channel-remove-error-notification")).not.toBeInTheDocument();
  });

  it("handles pagination correctly", async () => {
    const { mockFetch, child } = await setup();
    await act(() => child.onPaginationChange({ page: child.pagination.page + 1, limit: child.pagination.limit }));

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/notification-channels\?.*page=2/), expect.objectContaining({ method: "GET" }));
    });
  });

  async function setup() {
    const mockData = {
      data: Array.from({ length: 10 }, buildNotificationChannel),
      pagination: {
        page: 1,
        limit: 10,
        total: 11,
        totalPages: 2
      }
    };
    const mockFetch = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(jsonResponse(mockData)));
    const services = {
      queryClient: () => queryClient,
      api: () => createProxy(createApiSdk({ baseUrl: "", fetch: mockFetch }))
    };
    const childCapturer = createContainerTestingChildCapturer<NotificationChannelsListViewProps>();

    render(
      <CustomSnackbarProvider>
        <TestContainerProvider services={services}>
          <NotificationChannelsListContainer>{childCapturer.renderChild}</NotificationChannelsListContainer>
        </TestContainerProvider>
      </CustomSnackbarProvider>
    );

    const child = await childCapturer.awaitChild(({ data }) => !!data.length);

    return { mockData, mockFetch, child };
  }
});
