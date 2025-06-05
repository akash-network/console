import "@testing-library/jest-dom";

import React from "react";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { PopupProvider } from "@akashnetwork/ui/context";
import { capitalize, startCase } from "lodash";

import type { AlertsListViewProps } from "./AlertsListView";
import { AlertsListView } from "./AlertsListView";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { buildAlert } from "@tests/seeders/alert";

describe(AlertsListView.name, () => {
  it("renders loading spinner when isLoading is true", () => {
    setup({ isLoading: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders error message when isError is true", () => {
    setup({ isError: true });
    expect(screen.getByText("Error loading alerts")).toBeInTheDocument();
  });

  it("renders empty state message when no data is provided", () => {
    setup({ data: [] });
    expect(screen.getByText("No alerts found")).toBeInTheDocument();
  });

  it("renders table with alerts data", () => {
    const mockAlert = buildAlert();

    setup({ data: [mockAlert] });

    expect(screen.getByText(mockAlert.name)).toBeInTheDocument();
    expect(screen.getByText(startCase(mockAlert.type.toLowerCase()))).toBeInTheDocument();
    expect(screen.getByText(capitalize(mockAlert.status))).toBeInTheDocument();

    if (mockAlert.enabled) {
      expect(screen.getByTestId("alert-enabled-checkmark")).toBeInTheDocument();
    } else {
      expect(screen.getByTestId("alert-enabled-checkmark")).not.toBeInTheDocument();
    }

    if (mockAlert.params?.dseq) {
      expect(screen.getByText(mockAlert.params.dseq)).toBeInTheDocument();
    }
  });

  it("shows confirmation popup when remove button is clicked", async () => {
    const mockAlert = buildAlert();
    setup({ data: [mockAlert] });

    fireEvent.click(screen.getByTestId("remove-alert-button"));

    await waitFor(() => {
      expect(screen.getByTestId("remove-alert-confirmation-popup")).toBeInTheDocument();
    });

    expect(screen.getByText("Are you sure you want to remove this alert?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("calls onRemove when confirmed", async () => {
    const onRemove = jest.fn();
    const mockAlert = buildAlert();

    setup({ data: [mockAlert], onRemove });

    fireEvent.click(screen.getByTestId("remove-alert-button"));

    await waitFor(() => {
      expect(screen.getByTestId("remove-alert-confirmation-popup")).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(screen.getByTestId("remove-alert-confirmation-popup-confirm-button"));
    });

    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledWith(mockAlert.id);
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
    const mockData = Array.from({ length: 11 }, buildAlert);

    setup({ data: mockData, pagination });

    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  function setup(props: Partial<AlertsListViewProps> = {}) {
    const defaultProps: AlertsListViewProps = {
      pagination: {
        page: 1,
        limit: 10,
        total: 10,
        totalPages: 1
      },
      data: Array.from({ length: 10 }, buildAlert),
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
          <AlertsListView {...defaultProps} />
        </TooltipProvider>
      </PopupProvider>
    );
    return defaultProps;
  }
});
