import React from "react";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import { AlertsListContainer, type ChildrenProps as AlertsListViewProps } from "@src/components/alerts/AlertsListContainer/AlertsListContainer";
import { queryClient } from "@src/queries";
import { createApiSdk } from "@src/services/api-sdk/createApiSdk";

import { act, render, screen } from "@testing-library/react";
import { buildAlert } from "@tests/seeders/alert";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";
import { jsonResponse } from "@tests/unit/jsonResponse";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(AlertsListContainer.name, () => {
  it("renders alerts list with data", async () => {
    const { mockData, child } = await setup();
    expect(child.data).toEqual(mockData.data);
  });

  it("calls delete endpoint and shows success notification when alert removal succeeds", async () => {
    const { mockData, mockFetch, child } = await setup();
    await act(() => child.onRemove(mockData.data[0].id));

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`/v1/alerts/${mockData.data[0].id}`), expect.objectContaining({ method: "DELETE" }));
      expect(screen.getByTestId("alert-remove-success-notification")).toBeInTheDocument();
    });
  });

  it("calls delete endpoint and shows error notification when alert removal fails", async () => {
    const { mockData, mockFetch, child } = await setup();
    mockFetch.mockRejectedValue(new Error());
    await act(() => child.onRemove(mockData.data[0].id));

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(`/v1/alerts/${mockData.data[0].id}`), expect.objectContaining({ method: "DELETE" }));
      expect(screen.getByTestId("alert-remove-error-notification")).toBeInTheDocument();
    });
  });

  it("handles pagination correctly", async () => {
    const { mockFetch, child } = await setup();
    await act(() => child.onPaginationChange({ page: child.pagination.page + 1, limit: child.pagination.limit }));

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/\/v1\/alerts\?.*page=2/), expect.objectContaining({ method: "GET" }));
    });
  });

  async function setup() {
    const mockData = {
      data: Array.from({ length: 11 }, () => buildAlert({ type: faker.helpers.arrayElement(["DEPLOYMENT_BALANCE", "CHAIN_MESSAGE"]), deploymentName: "NA" })),
      pagination: {
        page: 1,
        limit: 10,
        total: 11,
        totalPages: 2
      }
    };
    const mockFetch = vi.fn(() => Promise.resolve(jsonResponse(mockData)));
    const services = {
      queryClient: () => queryClient,
      api: () => createProxy(createApiSdk({ baseUrl: "", fetch: mockFetch }))
    };
    const childCapturer = createContainerTestingChildCapturer<AlertsListViewProps>();

    render(
      <CustomSnackbarProvider>
        <TestContainerProvider services={services}>
          <AlertsListContainer>{childCapturer.renderChild}</AlertsListContainer>
        </TestContainerProvider>
      </CustomSnackbarProvider>
    );

    const child = await childCapturer.awaitChild(({ data }) => !!data.length);

    return { mockData, mockFetch, child };
  }
});
