import React from "react";
import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import type { RequestFn, RequestFnResponse } from "@openapi-qraft/tanstack-query-react-types";
import { describe, expect, it, vi } from "vitest";

import { NotificationChannelsListContainer } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import type { NotificationChannelsListViewProps } from "@src/components/alerts/NotificationChannelsListView/NotificationChannelsListView";
import { queryClient } from "@src/queries";

import { act, render, screen } from "@testing-library/react";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe("NotificationChannelsListContainer", () => {
  it("renders notification channels list with data", async () => {
    const { mockData, child } = await setup();
    expect(child.data).toEqual(mockData.data);
  });

  it("calls delete endpoint and shows success notification when removing a notification channel succeeds", async () => {
    const { mockData, requestFn, child } = await setup();
    await act(() => child.onRemove(mockData.data[0].id));

    await vi.waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({ method: "delete", url: "/v1/notification-channels/{id}" }),
        expect.objectContaining({ baseUrl: "", body: undefined, parameters: { path: { id: mockData.data[0].id } } })
      );
      expect(screen.getByTestId("notification-channel-remove-success-notification")).toBeInTheDocument();
    });
  });

  it("calls delete endpoint and shows error notification when removing a notification channel fails", async () => {
    const { mockData, requestFn, child } = await setup();
    requestFn.mockRejectedValue(new Error());
    await act(() => child.onRemove(mockData.data[0].id));

    await vi.waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({ method: "delete", url: "/v1/notification-channels/{id}" }),
        expect.objectContaining({ baseUrl: "", body: undefined, parameters: { path: { id: mockData.data[0].id } } })
      );
      expect(screen.getByTestId("notification-channel-remove-error-notification")).toBeInTheDocument();
    });
  });

  it("handles pagination correctly", async () => {
    const { requestFn, child } = await setup();
    await act(() => child.onPaginationChange({ page: child.pagination.page + 1, limit: child.pagination.limit }));

    await vi.waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({ method: "get", url: "/v1/notification-channels" }),
        expect.objectContaining({
          parameters: {
            query: {
              page: 2,
              limit: 10
            }
          }
        })
      );
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
    const requestFn = vi.fn(
      () =>
        Promise.resolve({
          data: mockData
        }) as Promise<RequestFnResponse<typeof mockData, unknown>>
    );
    const services = {
      queryClient: () => queryClient,
      notificationsApi: () =>
        createAPIClient({
          requestFn: requestFn as RequestFn<any, Error>,
          baseUrl: "",
          queryClient
        })
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

    return { mockData, requestFn, child };
  }
});
