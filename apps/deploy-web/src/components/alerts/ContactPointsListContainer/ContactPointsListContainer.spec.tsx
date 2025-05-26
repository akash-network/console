import "@testing-library/jest-dom";

import React from "react";
import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { CustomSnackbarProvider } from "@akashnetwork/ui/context";
import { faker } from "@faker-js/faker";
import type { RequestFnResponse } from "@openapi-qraft/react/src/lib/requestFn";
import { QueryClientProvider } from "@tanstack/react-query";

import { type ContactPoint, ContactPointsListContainer } from "@src/components/alerts/ContactPointsListContainer/ContactPointsListContainer";
import { ServicesProvider } from "@src/context/ServicesProvider";
import { queryClient } from "@src/queries";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";

describe("ContactPointsListContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders contact points list with data", async () => {
    const { mockData } = setup();

    await waitFor(() => {
      expect(screen.getByText(mockData.data[0].name)).toBeInTheDocument();
      expect(screen.getByText(mockData.data[1].name)).toBeInTheDocument();
    });
  });

  it("calls onEdit with correct ID when edit button is clicked", async () => {
    const { mockData, onEditMock } = setup();

    await waitFor(() => {
      expect(screen.getByTestId(`edit-contact-point-${mockData.data[0].id}`)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`edit-contact-point-${mockData.data[0].id}`));

    expect(onEditMock).toHaveBeenCalledWith(mockData.data[0].id);
  });

  it("shows confirmation dialog when remove button is clicked", async () => {
    const { mockData } = setup();

    await waitFor(() => {
      expect(screen.getByTestId(`remove-contact-point-${mockData.data[0].id}`)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`remove-contact-point-${mockData.data[0].id}`));

    expect(screen.getByTestId("confirm-remove-dialog")).toBeInTheDocument();
  });

  it("calls delete endpoint and shows success notification when removing a contact point", async () => {
    const { mockData, requestFn } = setup();

    await waitFor(() => {
      expect(screen.getByTestId(`remove-contact-point-${mockData.data[0].id}`)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`remove-contact-point-${mockData.data[0].id}`));
    fireEvent.click(screen.getByTestId("confirm-remove-button"));

    await waitFor(() => {
      expect(requestFn).toHaveBeenCalledWith(
        expect.objectContaining({ method: "delete", url: "/v1/contact-points/{id}" }),
        expect.objectContaining({ baseUrl: "", body: undefined, parameters: { path: { id: mockData.data[0].id } } })
      );
      expect(screen.getByTestId("contact-point-remove-success-notification")).toBeInTheDocument();
    });
  });

  it("shows error notification when removing a contact point fails", async () => {
    const { mockData, requestFn } = setup();

    requestFn.mockRejectedValue(new Error());

    await waitFor(() => {
      expect(screen.getByText(mockData.data[0].name)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`remove-contact-point-${mockData.data[0].id}`));
    fireEvent.click(screen.getByTestId("confirm-remove-button"));

    await waitFor(() => {
      expect(screen.getByTestId("contact-point-remove-error-notification")).toBeInTheDocument();
    });
  });

  it("handles pagination correctly", async () => {
    const { mockData, requestFn } = setup();

    await waitFor(() => {
      expect(screen.getByText(mockData.data[0].name)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("next-page-button"));

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

  function setup() {
    const onEditMock = jest.fn();
    const mockData = createMockContactPointsResponse();
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

    render(
      <CustomSnackbarProvider>
        <ServicesProvider services={services}>
          <QueryClientProvider client={queryClient}>
            <ContactPointsListContainer onEdit={onEditMock}>
              {({
                data,
                pagination,
                onPageChange,
                isLoading,
                isError,
                onEdit,
                isRemoving,
                contactPointIdToRemove,
                onRemoveStart,
                onRemoveCancel,
                onRemoveConfirm
              }) => (
                <div>
                  {isLoading && <div>Loading...</div>}
                  {isError && <div>Error loading contact points</div>}
                  <ul>
                    {data.map(contactPoint => (
                      <li key={contactPoint.id}>
                        <span>{contactPoint.name}</span>
                        <button data-testid={`edit-contact-point-${contactPoint.id}`} onClick={() => onEdit(contactPoint.id)}>
                          Edit
                        </button>
                        <button data-testid={`remove-contact-point-${contactPoint.id}`} onClick={() => onRemoveStart(contactPoint.id)}>
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div>
                    <span>
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button data-testid="prev-page-button" onClick={() => onPageChange(pagination.page - 1, pagination.limit)} disabled={pagination.page <= 1}>
                      Previous
                    </button>
                    <button
                      data-testid="next-page-button"
                      onClick={() => onPageChange(pagination.page, pagination.limit)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      Next
                    </button>
                  </div>
                  {contactPointIdToRemove && (
                    <div data-testid="confirm-remove-dialog">
                      <p>Are you sure you want to remove this contact point?</p>
                      <button data-testid="confirm-remove-button" onClick={onRemoveConfirm} disabled={isRemoving}>
                        {isRemoving ? "Removing..." : "Confirm"}
                      </button>
                      <button data-testid="cancel-remove-button" onClick={onRemoveCancel} disabled={isRemoving}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </ContactPointsListContainer>
          </QueryClientProvider>
        </ServicesProvider>
      </CustomSnackbarProvider>
    );

    return { mockData, requestFn, onEditMock };
  }

  function createMockContactPointsResponse() {
    const contactPoints: ContactPoint[] = Array.from({ length: 11 }, () => ({
      id: faker.string.uuid(),
      name: faker.string.alphanumeric(),
      type: "email",
      config: {
        addresses: [faker.internet.email()]
      },
      userId: faker.string.uuid(),
      createdAt: faker.date.recent(),
      updatedAt: faker.date.recent()
    }));

    return {
      data: contactPoints,
      pagination: {
        page: 1,
        limit: 10,
        total: 11,
        totalPages: 2
      }
    };
  }
});
