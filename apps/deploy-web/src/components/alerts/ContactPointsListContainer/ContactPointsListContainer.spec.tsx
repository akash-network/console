import "@testing-library/jest-dom";

import React from "react";
import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import type { RequestFn, RequestFnResponse } from "@openapi-qraft/tanstack-query-react-types";
import { QueryClientProvider } from "@tanstack/react-query";

import { ContactPointsListContainer } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";
import type { ContactPointsListViewProps } from "@src/components/alerts/ContactPointsListView/ContactPointsListView";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { queryClient } from "@src/queries";

import { render, screen, waitFor } from "@testing-library/react";
import { buildContactPoint } from "@tests/seeders/contactPoint";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

describe("ContactPointsListContainer", () => {
  it("renders contact points list with data", async () => {
    const { mockData, child } = await setup();
    expect(child.data).toEqual(mockData.data);
  });

  it("calls delete endpoint and shows success notification when removing a contact point succeeds", async () => {
    const { mockData, requestFn, child } = await setup();
    child.onRemove(mockData.data[0].id);

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({ method: "delete", url: "/v1/contact-points/{id}" }),
        expect.objectContaining({ baseUrl: "", body: undefined, parameters: { path: { id: mockData.data[0].id } } })
      );
      expect(screen.getByTestId("contact-point-remove-success-notification")).toBeInTheDocument();
    });
  });

  it("calls delete endpoint and shows error notification when removing a contact point fails", async () => {
    const { mockData, requestFn, child } = await setup();
    requestFn.mockRejectedValue(new Error());
    child.onRemove(mockData.data[0].id);

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({ method: "delete", url: "/v1/contact-points/{id}" }),
        expect.objectContaining({ baseUrl: "", body: undefined, parameters: { path: { id: mockData.data[0].id } } })
      );
      expect(screen.getByTestId("contact-point-remove-error-notification")).toBeInTheDocument();
    });
  });

  it("handles pagination correctly", async () => {
    const { requestFn, child } = await setup();
    child.onPaginationChange({ page: child.pagination.page + 1, limit: child.pagination.limit });

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({ method: "get", url: "/v1/contact-points" }),
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
      data: Array.from({ length: 10 }, buildContactPoint),
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
          requestFn: requestFn as RequestFn<any, Error>,
          baseUrl: "",
          queryClient
        })
    };
    const childCapturer = createContainerTestingChildCapturer<ContactPointsListViewProps>();

    render(
      <CustomSnackbarProvider>
        <ServicesProvider services={services}>
          <QueryClientProvider client={queryClient}>
            <ContactPointsListContainer>{childCapturer.renderChild}</ContactPointsListContainer>
          </QueryClientProvider>
        </ServicesProvider>
      </CustomSnackbarProvider>
    );

    const child = await childCapturer.awaitChild(({ data }) => !!data.length);

    return { mockData, requestFn, child };
  }
});
