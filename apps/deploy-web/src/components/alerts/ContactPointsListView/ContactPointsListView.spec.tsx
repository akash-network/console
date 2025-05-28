import "@testing-library/jest-dom";

import React from "react";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { PopupProvider } from "@akashnetwork/ui/context";

import type { ContactPointsListViewProps } from "./ContactPointsListView";
import { ContactPointsListView } from "./ContactPointsListView";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildContactPoint } from "@tests/seeders/contactPoint";

describe("ContactPointsListView", () => {
  it("renders loading spinner when isLoading is true", () => {
    setup({ isLoading: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders error message when isError is true", () => {
    setup({ isError: true });
    expect(screen.getByText("Error loading contact points")).toBeInTheDocument();
  });

  it("renders empty state message when no data is provided", () => {
    setup({ data: [] });
    expect(screen.getByText("No contact points found")).toBeInTheDocument();
  });

  it("renders table with contact points data", () => {
    const mockContactPoint = buildContactPoint();

    setup({ data: [mockContactPoint] });

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Addresses")).toBeInTheDocument();

    expect(screen.getByText(mockContactPoint.name)).toBeInTheDocument();
    expect(screen.getByText("email")).toBeInTheDocument();
    expect(screen.getByText(mockContactPoint.config.addresses[0])).toBeInTheDocument();
  });

  it("calls onEdit when edit button is clicked", () => {
    const onEdit = jest.fn();
    const mockContactPoint = buildContactPoint();

    setup({ data: [mockContactPoint], onEdit });

    fireEvent.click(screen.getByTestId("edit-contact-point-button"));
    expect(onEdit).toHaveBeenCalledWith(mockContactPoint.id);
  });

  it("shows confirmation popup when remove button is clicked", async () => {
    const mockContactPoint = buildContactPoint();
    setup({ data: [mockContactPoint] });

    fireEvent.click(screen.getByTestId("remove-contact-point-button"));

    await waitFor(() => {
      expect(screen.getByTestId("remove-contact-point-confirmation-popup")).toBeInTheDocument();
    });

    expect(screen.getByText("Are you sure you want to remove this contact point?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("calls onRemove when confirmed", async () => {
    const onRemove = jest.fn();
    const mockContactPoint = buildContactPoint();

    setup({ data: [mockContactPoint], onRemove });

    fireEvent.click(screen.getByTestId("remove-contact-point-button"));

    await waitFor(() => {
      expect(screen.getByTestId("remove-contact-point-confirmation-popup")).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(screen.getByTestId("remove-contact-point-confirmation-popup-confirm-button"));
    });

    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledWith(mockContactPoint.id);
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
    const mockData = Array.from({ length: 11 }, buildContactPoint);

    setup({ data: mockData, pagination });

    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  function setup(props: Partial<ContactPointsListViewProps> = {}) {
    const defaultProps: ContactPointsListViewProps = {
      pagination: {
        page: 1,
        limit: 10,
        total: 10,
        totalPages: 1
      },
      data: Array.from({ length: 10 }, buildContactPoint),
      isLoading: false,
      onEdit: jest.fn(),
      onRemove: jest.fn(),
      idsBeingRemoved: new Set(),
      onPageChange: jest.fn(),
      isError: false,
      ...props
    };

    render(
      <PopupProvider>
        <TooltipProvider>
          <ContactPointsListView {...defaultProps} />
        </TooltipProvider>
      </PopupProvider>
    );
    return defaultProps;
  }
});
