import "@testing-library/jest-dom";

import React from "react";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { PopupProvider } from "@akashnetwork/ui/context";
import { capitalize, startCase } from "lodash";

import type { useFlag } from "@src/hooks/useFlag";
import type { Props } from "./AlertsListView";
import { AlertsListView } from "./AlertsListView";

import { render, screen } from "@testing-library/react";
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

  it("renders table with enabled alert with params", () => {
    const mockAlert = buildAlert({
      type: "DEPLOYMENT_BALANCE",
      enabled: true,
      params: { owner: "owner", dseq: "12345" }
    });

    setup({ data: [mockAlert] });

    expect(screen.getByText(mockAlert.deploymentName)).toBeInTheDocument();
    expect(screen.getByText("Threshold")).toBeInTheDocument();
    expect(screen.getByText(capitalize(mockAlert.status))).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();

    expect(screen.getByText("12345")).toBeInTheDocument();
  });

  it("renders table with disabled alert without params", () => {
    const mockAlert = buildAlert({
      type: "CHAIN_MESSAGE",
      enabled: false,
      params: undefined
    });

    setup({ data: [mockAlert] });

    expect(screen.getByText(mockAlert.deploymentName)).toBeInTheDocument();
    expect(screen.getByText(startCase(mockAlert.type.toLowerCase()))).toBeInTheDocument();
    expect(screen.getByText(capitalize(mockAlert.status))).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();

    expect(screen.getByText("N/A")).toBeInTheDocument();
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

  function setup(props: Partial<Props> = {}) {
    const defaultProps: Props = {
      pagination: {
        page: 1,
        limit: 10,
        total: 10,
        totalPages: 1
      },
      data: Array.from({ length: 10 }, buildAlert),
      isLoading: false,
      onToggle: jest.fn(),
      loadingIds: new Set(),
      onPaginationChange: jest.fn(),
      isError: false,
      ...props
    };

    const mockUseFlag = jest.fn((flag: string) => {
      if (flag === "notifications_general_alerts_update") {
        return true;
      }
      return false;
    }) as unknown as ReturnType<typeof useFlag>;

    const dependencies: NonNullable<Props["dependencies"]> = {
      useFlag: () => mockUseFlag
    };

    render(
      <PopupProvider>
        <TooltipProvider>
          <AlertsListView {...defaultProps} dependencies={dependencies} />
        </TooltipProvider>
      </PopupProvider>
    );
    return defaultProps;
  }
});
