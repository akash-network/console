import React from "react";
import { describe, expect, it, vi } from "vitest";

import { UrlService } from "@src/utils/urlUtils";
import type { Props } from "./AlertsListView";
import { AlertsListView, DEPENDENCIES } from "./AlertsListView";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildAlert } from "@tests/seeders/alert";

describe(AlertsListView.name, () => {
  it("shows a skeleton and no count while alerts load", () => {
    setup({ isLoading: true });

    expect(screen.getByTestId("alerts-table-skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ alerts?$/)).not.toBeInTheDocument();
  });

  it("explains that alerts failed to load", () => {
    setup({ isError: true });

    expect(screen.getByText("Error loading alerts")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no alerts", () => {
    setup({ data: [], total: 0 });

    expect(screen.getByText("No alerts yet")).toBeInTheDocument();
    expect(screen.getByText("0 alerts")).toBeInTheDocument();
  });

  it.each([
    { total: 1, label: "1 alert" },
    { total: 24, label: "24 alerts" }
  ])("counts every alert on all pages as $label", ({ total, label }) => {
    setup({ data: [buildDeploymentCloseAlert()], total });

    expect(screen.getByRole("region", { name: "Deployment alerts" })).toHaveTextContent(label);
  });

  it("shows an alert's deployment, DSEQ, type, status and channel in one row", () => {
    const alert = buildDeploymentCloseAlert({ deploymentName: "web", dseq: "4242", status: "TRIGGERED", notificationChannelName: "Ops team" });

    setup({ data: [alert] });

    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells.map(cell => cell.textContent)).toEqual(["", "web", "4242", "Deployment Close", "Triggered", "Ops team", ""]);
  });

  it("names the columns in the order of the cells", () => {
    setup({ data: [buildDeploymentCloseAlert()] });

    expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual([
      "Enabled",
      "Deployment Name",
      "DSEQ",
      "Type",
      "Status",
      "Notification Channel",
      "Actions"
    ]);
  });

  it("links the deployment name to the deployment's settings tab", () => {
    setup({ data: [buildDeploymentCloseAlert({ deploymentName: "web", dseq: "4242" })] });

    expect(screen.getByRole("link", { name: "web" })).toHaveAttribute("href", UrlService.deploymentDetails("4242", "SETTINGS"));
  });

  it("links a deployment without a name as an unnamed deployment", () => {
    setup({ data: [buildDeploymentCloseAlert({ deploymentName: null, dseq: "4242" })] });

    expect(screen.getByRole("link", { name: "Unnamed deployment" })).toHaveAttribute("href", UrlService.deploymentDetails("4242", "SETTINGS"));
    expect(screen.getByRole("checkbox", { name: "Enable Deployment Close alert for deployment 4242" })).toBeInTheDocument();
  });

  it("shows the alert's own name for an alert that watches no deployment", () => {
    const alert = buildAlert({ type: "WALLET_BALANCE", name: "Low balance", deploymentName: null });

    setup({ data: [alert] });

    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("Low balance");
    expect(cells[2]).toHaveTextContent("N/A");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each([
    { label: "Network Activity", alert: buildAlert({ type: "CHAIN_MESSAGE", params: undefined }) },
    { label: "Deployment Event", alert: buildAlert({ type: "CHAIN_EVENT", params: undefined }) },
    { label: "Deployment Close", alert: buildAlert({ type: "CHAIN_EVENT" }) },
    { label: "Wallet Balance", alert: buildAlert({ type: "WALLET_BALANCE" }) }
  ])("labels a $alert.type alert as $label", ({ alert, label }) => {
    setup({ data: [alert] });

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([
    { enabled: true, nextEnabled: false },
    { enabled: false, nextEnabled: true }
  ])("turns an alert that is enabled=$enabled to $nextEnabled from its checkbox", async ({ enabled, nextEnabled }) => {
    const alert = buildDeploymentCloseAlert({ deploymentName: "web", dseq: "4242", enabled });
    const { onToggle } = setup({ data: [alert] });

    const checkbox = screen.getByRole("checkbox", { name: "Enable Deployment Close alert for web" });
    expect(checkbox).toHaveAttribute("aria-checked", String(enabled));

    await userEvent.click(checkbox);

    expect(onToggle).toHaveBeenCalledWith(alert.id, nextEnabled, "4242");
  });

  it("locks the checkbox while that alert is being toggled", () => {
    const alert = buildDeploymentCloseAlert({ deploymentName: "web" });

    setup({ data: [alert], loadingIds: new Set([alert.id]) });

    expect(screen.getByRole("checkbox", { name: "Enable Deployment Close alert for web" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Deployment Close alert for web" })).toBeEnabled();
  });

  it("locks editing while that wallet balance alert is being toggled", () => {
    const alert = buildAlert({ type: "WALLET_BALANCE", name: "Low balance", deploymentName: null });

    setup({ data: [alert], loadingIds: new Set([alert.id]) });

    expect(screen.getByRole("button", { name: "Edit Wallet Balance alert for Low balance" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Wallet Balance alert for Low balance" })).toBeEnabled();
  });

  it("locks the checkbox and actions while that alert is being deleted", () => {
    const alert = buildAlert({ type: "WALLET_BALANCE", name: "Low balance", deploymentName: null });

    setup({ data: [alert], removingIds: new Set([alert.id]) });

    expect(screen.getByRole("checkbox", { name: "Enable Wallet Balance alert for Low balance" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Wallet Balance alert for Low balance" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit Wallet Balance alert for Low balance" })).toBeDisabled();
  });

  it("deletes an alert once the deletion is confirmed", async () => {
    const alert = buildDeploymentCloseAlert({ deploymentName: "web" });
    const { onRemove } = setup({ data: [alert] });

    await userEvent.click(screen.getByRole("button", { name: "Delete Deployment Close alert for web" }));

    const dialog = screen.getByRole("dialog", { name: "Delete Deployment Close alert for “web”?" });
    expect(dialog).toHaveTextContent("You'll stop receiving notifications for this alert. You can turn it on again from the deployment's Settings tab.");
    expect(onRemove).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(onRemove).toHaveBeenCalledWith(alert.id);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the confirmation open while the deletion is in flight", async () => {
    const alert = buildDeploymentCloseAlert({ deploymentName: "web" });
    const { rerender, props } = setup({ data: [alert], onRemove: () => new Promise<void>(() => {}) });

    await userEvent.click(screen.getByRole("button", { name: "Delete Deployment Close alert for web" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    rerender({ ...props, removingIds: new Set([alert.id]) });

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /Delete/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("doesn't mention the deployment when deleting an alert that watches none", async () => {
    setup({ data: [buildAlert({ type: "WALLET_BALANCE", name: "Low balance", deploymentName: null })] });

    await userEvent.click(screen.getByRole("button", { name: "Delete Wallet Balance alert for Low balance" }));

    expect(screen.getByRole("dialog", { name: "Delete Wallet Balance alert for “Low balance”?" })).toHaveTextContent(
      "You'll stop receiving notifications for this alert."
    );
    expect(screen.getByRole("dialog")).not.toHaveTextContent("Settings tab");
  });

  it("keeps the alert when the deletion is cancelled", async () => {
    const { onRemove } = setup({ data: [buildDeploymentCloseAlert({ deploymentName: "web" })] });

    await userEvent.click(screen.getByRole("button", { name: "Delete Deployment Close alert for web" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the wallet balance alert in the edit dialog", async () => {
    const alert = buildAlert({ type: "WALLET_BALANCE", name: "Low balance", deploymentName: null });
    const { WalletBalanceAlertDialog } = setup({ data: [alert] });

    await userEvent.click(screen.getByRole("button", { name: "Edit Wallet Balance alert for Low balance" }));

    expect(WalletBalanceAlertDialog.mock.lastCall?.[0].alert).toBe(alert);
    expect(screen.getByTestId("wallet-balance-alert-dialog")).toBeInTheDocument();
  });

  it("closes the edit dialog when it asks to", async () => {
    setup({ data: [buildAlert({ type: "WALLET_BALANCE", name: "Low balance", deploymentName: null })] });

    await userEvent.click(screen.getByRole("button", { name: "Edit Wallet Balance alert for Low balance" }));
    await userEvent.click(screen.getByRole("button", { name: "Close edit dialog" }));

    expect(screen.queryByTestId("wallet-balance-alert-dialog")).not.toBeInTheDocument();
  });

  it("offers no edit action for alerts other than wallet balance", () => {
    setup({ data: [buildDeploymentCloseAlert({ deploymentName: "web" })] });

    expect(screen.queryByRole("button", { name: /^Edit/ })).not.toBeInTheDocument();
  });

  it("doesn't show the pagination while every alert fits on one page", () => {
    const { CustomPagination } = setup({ total: 10 });

    expect(CustomPagination).not.toHaveBeenCalled();
  });

  it("pages through the alerts once there are more than fit on one page", () => {
    const { CustomPagination, onPaginationChange } = setup({ total: 11, totalPages: 2, page: 2, limit: 10 });

    const paginationProps = CustomPagination.mock.lastCall![0];
    expect(paginationProps).toMatchObject({ pageIndex: 1, pageSize: 10, totalPageCount: 2 });

    paginationProps.setPageIndex(0);
    expect(onPaginationChange).toHaveBeenLastCalledWith({ page: 1, limit: 10 });

    paginationProps.setPageSize(50);
    expect(onPaginationChange).toHaveBeenLastCalledWith({ page: 1, limit: 50 });
  });

  function buildDeploymentCloseAlert(
    input: { deploymentName?: string | null; dseq?: string; enabled?: boolean; status?: string; notificationChannelName?: string } = {}
  ) {
    return buildAlert({
      type: "CHAIN_EVENT",
      deploymentName: input.deploymentName === undefined ? "web" : input.deploymentName,
      enabled: input.enabled ?? true,
      status: input.status ?? "OK",
      notificationChannelName: input.notificationChannelName ?? "Default",
      params: { dseq: input.dseq ?? "4242", type: "DEPLOYMENT_CLOSED" }
    });
  }

  function setup(input: Partial<Omit<Props, "pagination" | "dependencies">> & { total?: number; totalPages?: number; page?: number; limit?: number } = {}) {
    const CustomPagination = vi.fn<typeof DEPENDENCIES.CustomPagination>(() => <nav />);
    const WalletBalanceAlertDialog = vi.fn<typeof DEPENDENCIES.WalletBalanceAlertDialog>(({ onClose }) => (
      <div data-testid="wallet-balance-alert-dialog">
        <button onClick={onClose}>Close edit dialog</button>
      </div>
    ));
    const onPaginationChange = vi.fn();
    const data = input.data ?? Array.from({ length: 3 }, () => buildDeploymentCloseAlert());
    const props: Props = {
      data,
      pagination: { page: input.page ?? 1, limit: input.limit ?? 10, total: input.total ?? data.length, totalPages: input.totalPages ?? 1 },
      isLoading: input.isLoading ?? false,
      isError: input.isError ?? false,
      onToggle: input.onToggle ?? vi.fn(),
      onRemove: input.onRemove ?? vi.fn(() => Promise.resolve()),
      loadingIds: input.loadingIds ?? new Set(),
      removingIds: input.removingIds ?? new Set(),
      onPaginationChange,
      dependencies: { ...DEPENDENCIES, CustomPagination, WalletBalanceAlertDialog }
    };

    const { rerender } = render(<AlertsListView {...props} />);

    return {
      props,
      rerender: (nextProps: Props) => rerender(<AlertsListView {...nextProps} />),
      onToggle: props.onToggle,
      onRemove: props.onRemove,
      onPaginationChange,
      CustomPagination,
      WalletBalanceAlertDialog
    };
  }
});
