import "@testing-library/jest-dom";

import React from "react";
import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import type { RequestFnResponse } from "@openapi-qraft/react/src/lib/requestFn";
import { QueryClientProvider } from "@tanstack/react-query";

import { AlertsListContainer } from "@src/components/alerts/AlertsListContainer/AlertsListContainer";
import type { AlertsListViewProps } from "@src/components/alerts/AlertsListView/AlertsListView";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { queryClient } from "@src/queries";

import { render, screen, waitFor } from "@testing-library/react";
import { buildAlert } from "@tests/seeders/alert";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

describe(AlertsListContainer.name, () => {
  it("renders alerts list with data", async () => {
    const { mockData, child } = await setup();
    expect(child.data).toEqual(mockData.data);
  });

  it("calls delete endpoint and shows success notification when alert removal succeeds", async () => {
    const { mockData, requestFn, child } = await setup();
    child.onRemove(mockData.data[0].id);

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({ method: "delete", url: "/v1/alerts/{id}" }),
        expect.objectContaining({ baseUrl: "", body: undefined, parameters: { path: { id: mockData.data[0].id } } })
      );
      expect(screen.getByTestId("alert-remove-success-notification")).toBeInTheDocument();
    });
  });

  it("calls delete endpoint and shows error notification when alert removal fails", async () => {
    const { mockData, requestFn, child } = await setup();
    requestFn.mockRejectedValue(new Error());
    child.onRemove(mockData.data[0].id);

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({ method: "delete", url: "/v1/alerts/{id}" }),
        expect.objectContaining({ baseUrl: "", body: undefined, parameters: { path: { id: mockData.data[0].id } } })
      );
      expect(screen.getByTestId("alert-remove-error-notification")).toBeInTheDocument();
    });
  });

  it("handles pagination correctly", async () => {
    const { requestFn, child } = await setup();
    child.onPaginationChange({ page: child.pagination.page + 1, limit: child.pagination.limit });

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({ method: "get", url: "/v1/alerts" }),
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
      data: Array.from({ length: 11 }, buildAlert),
      pagination: {
        page: 1,
        limit: 10,
        total: 11,
        totalPages: 2
      }
    };
    const requestFn = jest.fn(
      () =>
        Promise.resolve({
          data: mockData
        }) as Promise<RequestFnResponse<typeof mockData, unknown>>
    );
    const services = {
      notificationsApi: () =>
        createAPIClient({
          requestFn,
          baseUrl: "",
          queryClient
        })
    };
    const childCapturer = createContainerTestingChildCapturer<AlertsListViewProps>();

    render(
      <CustomSnackbarProvider>
        <ServicesProvider services={services}>
          <QueryClientProvider client={queryClient}>
            <AlertsListContainer>{childCapturer.renderChild}</AlertsListContainer>
          </QueryClientProvider>
        </ServicesProvider>
      </CustomSnackbarProvider>
    );

    const child = await childCapturer.awaitChild(({ data }) => !!data.length);

    return { mockData, requestFn, child };
  }
});
