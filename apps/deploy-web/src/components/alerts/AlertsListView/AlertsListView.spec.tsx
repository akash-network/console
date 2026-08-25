import React from "react";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { PopupProvider } from "@akashnetwork/ui/context";
import { capitalize, startCase } from "lodash";
import { describe, expect, it, vi } from "vitest";

import type { useFlag } from "@src/hooks/useFlag";
import { UrlService } from "@src/utils/urlUtils";
import type { Props } from "./AlertsListView";
import { AlertsListView } from "./AlertsListView";

import { act, fireEvent, render, screen } from "@testing-library/react";
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
      type: "CHAIN_MESSAGE",
      enabled: true,
      params: { dseq: "12345", type: "DEPLOYMENT_CLOSED" }
    });

    setup({ data: [mockAlert] });

    expect(screen.getByText(mockAlert.deploymentName)).toBeInTheDocument();
    expect(screen.getByText("Deployment Close")).toBeInTheDocument();
    expect(screen.getByText(capitalize(mockAlert.status))).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();

    expect(screen.getByText("12345")).toBeInTheDocument();
  });

  it("does not render DEPLOYMENT_BALANCE alerts", () => {
    const hiddenAlert = buildAlert({
      type: "DEPLOYMENT_BALANCE",
      params: { owner: "owner", dseq: "12345" }
    });
    const visibleAlert = buildAlert({
      type: "CHAIN_MESSAGE",
      params: { dseq: "67890", type: "DEPLOYMENT_CLOSED" }
    });

    setup({ data: [hiddenAlert, visibleAlert] });

    expect(screen.queryByText("Escrow Threshold")).not.toBeInTheDocument();
    expect(screen.queryByText(hiddenAlert.deploymentName)).not.toBeInTheDocument();
    expect(screen.getByText(visibleAlert.deploymentName)).toBeInTheDocument();
    expect(screen.getByText("Deployment Close")).toBeInTheDocument();
  });

  it("shows empty state when every alert is DEPLOYMENT_BALANCE", () => {
    setup({
      data: [buildAlert({ type: "DEPLOYMENT_BALANCE", params: { owner: "owner", dseq: "12345" } })]
    });

    expect(screen.getByText("No alerts found")).toBeInTheDocument();
    expect(screen.queryByText("Escrow Threshold")).not.toBeInTheDocument();
  });

  it("links the deployment name to the settings tab", () => {
    const mockAlert = buildAlert({ type: "CHAIN_MESSAGE", params: { dseq: "12345", type: "DEPLOYMENT_CLOSED" } });

    setup({ data: [mockAlert] });

    expect(screen.getByRole("link", { name: mockAlert.deploymentName })).toHaveAttribute("href", UrlService.deploymentDetails("12345", "SETTINGS"));
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

  it("renders an edit link to the alert detail page for wallet balance alerts", () => {
    const mockAlert = buildAlert({ type: "WALLET_BALANCE" });

    setup({ data: [mockAlert] });

    expect(screen.getByTestId("edit-alert-button")).toHaveAttribute("href", UrlService.alertDetails(mockAlert.id));
  });

  it("does not render an edit link for non wallet balance alerts", () => {
    const mockAlert = buildAlert({ type: "CHAIN_MESSAGE", params: { dseq: "12345", type: "DEPLOYMENT_CLOSED" } });

    setup({ data: [mockAlert] });

    expect(screen.queryByTestId("edit-alert-button")).not.toBeInTheDocument();
  });

  it("hides the actions when the update feature flag is disabled", () => {
    const mockAlert = buildAlert({ type: "WALLET_BALANCE" });

    setup({ data: [mockAlert], isAlertUpdateEnabled: false });

    expect(screen.queryByTestId("edit-alert-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("remove-alert-button")).not.toBeInTheDocument();
  });

  it("calls onRemove after the removal is confirmed", async () => {
    const onRemove = vi.fn();
    const mockAlert = buildAlert({ type: "WALLET_BALANCE" });

    setup({ data: [mockAlert], onRemove });

    fireEvent.click(screen.getByTestId("remove-alert-button"));

    await vi.waitFor(() => {
      expect(screen.getByTestId("remove-alert-confirmation-popup")).toBeInTheDocument();
    });

    act(() => {
      fireEvent.click(screen.getByTestId("remove-alert-confirmation-popup-confirm-button"));
    });

    await vi.waitFor(() => {
      expect(onRemove).toHaveBeenCalledWith(mockAlert.id);
    });
  });

  it("disables the actions and shows the removal spinner while a removal is in flight", () => {
    const mockAlert = buildAlert({ type: "WALLET_BALANCE" });

    setup({ data: [mockAlert], removingIds: new Set([mockAlert.id]) });

    expect(screen.getByTestId("remove-alert-button")).toBeDisabled();
    expect(screen.getByTestId("edit-alert-button")).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps the remove and edit actions interactive while only a toggle is in flight", () => {
    const mockAlert = buildAlert({ type: "WALLET_BALANCE" });

    setup({ data: [mockAlert], loadingIds: new Set([mockAlert.id]) });

    expect(screen.getByTestId("remove-alert-button")).not.toBeDisabled();
    expect(screen.getByTestId("edit-alert-button")).toHaveAttribute("aria-disabled", "false");
  });

  it("disables the enabled checkbox while a removal is in flight so a toggle can't race the delete", () => {
    const mockAlert = buildAlert({ type: "WALLET_BALANCE", enabled: true });

    setup({ data: [mockAlert], removingIds: new Set([mockAlert.id]) });

    expect(screen.getByRole("checkbox")).toBeDisabled();
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

  function setup({ isAlertUpdateEnabled = true, ...props }: Partial<Props> & { isAlertUpdateEnabled?: boolean } = {}) {
    const defaultProps: Props = {
      pagination: {
        page: 1,
        limit: 10,
        total: 10,
        totalPages: 1
      },
      data: Array.from({ length: 10 }, buildAlert),
      isLoading: false,
      onToggle: vi.fn(),
      onRemove: vi.fn(),
      loadingIds: new Set(),
      removingIds: new Set(),
      onPaginationChange: vi.fn(),
      isError: false,
      ...props
    };

    const mockUseFlag = vi.fn((flag: string) => flag === "notifications_general_alerts_update" && isAlertUpdateEnabled) as unknown as typeof useFlag;

    const dependencies: NonNullable<Props["dependencies"]> = {
      useFlag: mockUseFlag
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
