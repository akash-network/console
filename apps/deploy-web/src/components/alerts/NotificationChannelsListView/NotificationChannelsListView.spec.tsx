import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { RemoveNotificationChannelResult } from "@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer";
import type { NotificationChannelsListViewProps } from "./NotificationChannelsListView";
import { DEPENDENCIES, NotificationChannelsListView } from "./NotificationChannelsListView";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildNotificationChannel } from "@tests/seeders/notificationChannel";

describe(NotificationChannelsListView.name, () => {
  it("shows a skeleton and no count while channels load", () => {
    setup({ isLoading: true });

    expect(screen.getByTestId("channels-table-skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ channels?$/)).not.toBeInTheDocument();
  });

  it("explains that channels failed to load", () => {
    setup({ isError: true });

    expect(screen.getByText("Error loading notification channels")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no channels", () => {
    setup({ data: [], total: 0 });

    expect(screen.getByText("No notification channels")).toBeInTheDocument();
  });

  it.each([
    { total: 1, label: "1 channel" },
    { total: 12, label: "12 channels" }
  ])("counts every channel on all pages as $label", ({ total, label }) => {
    setup({ data: [buildNotificationChannel()], total });

    expect(within(screen.getByRole("region", { name: "Notification channels" })).getByText(label)).toBeInTheDocument();
  });

  it("shows a channel's name, type and every address in one row", () => {
    const channel = buildNotificationChannel({ name: "Ops team", config: { addresses: ["ops@acme.dev", "oncall@acme.dev"] } });

    setup({ data: [channel] });

    expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Name", "Type", "Email", "Actions"]);
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells.map(cell => cell.textContent)).toEqual(["Ops team", "Email", "ops@acme.devoncall@acme.dev", ""]);
    expect(screen.getByText("ops@acme.dev")).toHaveAttribute("title", "ops@acme.dev");
  });

  it("opens the channel in the edit dialog and closes it when asked", async () => {
    const channel = buildNotificationChannel({ name: "Ops team" });
    const { NotificationChannelDialog } = setup({ data: [channel] });

    await userEvent.click(screen.getByRole("button", { name: "Edit Ops team" }));

    expect(NotificationChannelDialog.mock.lastCall?.[0].notificationChannel).toBe(channel);

    await userEvent.click(screen.getByRole("button", { name: "Close channel dialog" }));

    expect(screen.queryByTestId("notification-channel-dialog")).not.toBeInTheDocument();
  });

  it("deletes a channel once the deletion is confirmed", async () => {
    const channel = buildNotificationChannel({ name: "Ops team" });
    const { onRemove } = setup({ data: [channel] });

    await userEvent.click(screen.getByRole("button", { name: "Delete Ops team" }));

    const dialog = screen.getByRole("dialog", { name: "Delete “Ops team”?" });
    expect(dialog).toHaveTextContent("This channel will no longer receive notifications.");

    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(onRemove).toHaveBeenCalledWith(channel.id);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the confirmation when the deletion fails for another reason", async () => {
    setup({ data: [buildNotificationChannel({ name: "Ops team" })], removeResult: "failed" });

    await userEvent.click(screen.getByRole("button", { name: "Delete Ops team" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explains why a channel that alerts still use can't be deleted", async () => {
    setup({ data: [buildNotificationChannel({ name: "Ops team" })], removeResult: "in-use" });

    await userEvent.click(screen.getByRole("button", { name: "Delete Ops team" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: "Delete “Ops team”?" });
    expect(dialog).toHaveTextContent("Alerts still use this channel, so it can't be deleted.");
    expect(within(dialog).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "OK" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("forgets the refusal when another deletion starts", async () => {
    setup({ data: [buildNotificationChannel({ name: "Ops team" }), buildNotificationChannel({ name: "On-call" })], removeResult: "in-use" });

    await userEvent.click(screen.getByRole("button", { name: "Delete Ops team" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete On-call" }));

    const dialog = screen.getByRole("dialog", { name: "Delete “On-call”?" });
    expect(dialog).not.toHaveTextContent("Alerts still use this channel");
    expect(within(dialog).getByRole("button", { name: "Delete" })).toBeEnabled();
  });

  it("keeps the channel when the deletion is cancelled", async () => {
    const { onRemove } = setup({ data: [buildNotificationChannel({ name: "Ops team" })] });

    await userEvent.click(screen.getByRole("button", { name: "Delete Ops team" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("locks a channel's actions while it is being deleted", () => {
    const channel = buildNotificationChannel({ name: "Ops team" });

    setup({ data: [channel], removingIds: new Set([channel.id]) });

    expect(screen.getByRole("button", { name: "Edit Ops team" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete Ops team" })).toBeDisabled();
  });

  it("doesn't show the pagination while every channel fits on one page", () => {
    const { CustomPagination } = setup({ total: 10 });

    expect(CustomPagination).not.toHaveBeenCalled();
  });

  it("pages through the channels once there are more than fit on one page", () => {
    const { CustomPagination, onPaginationChange } = setup({ total: 11, totalPages: 2, page: 2 });

    const paginationProps = CustomPagination.mock.lastCall![0];
    expect(paginationProps).toMatchObject({ pageIndex: 1, pageSize: 10, totalPageCount: 2 });

    paginationProps.setPageIndex(0);
    expect(onPaginationChange).toHaveBeenLastCalledWith({ page: 1, limit: 10 });

    paginationProps.setPageSize(25);
    expect(onPaginationChange).toHaveBeenLastCalledWith({ page: 1, limit: 25 });
  });

  function setup(
    input: Partial<Pick<NotificationChannelsListViewProps, "data" | "isLoading" | "isError" | "removingIds">> & {
      total?: number;
      totalPages?: number;
      page?: number;
      removeResult?: RemoveNotificationChannelResult;
    } = {}
  ) {
    const CustomPagination = vi.fn<typeof DEPENDENCIES.CustomPagination>(() => <nav />);
    const NotificationChannelDialog = vi.fn<typeof DEPENDENCIES.NotificationChannelDialog>(({ onClose }) => (
      <div data-testid="notification-channel-dialog">
        <button onClick={onClose}>Close channel dialog</button>
      </div>
    ));
    const onRemove = vi.fn(() => Promise.resolve(input.removeResult ?? "removed"));
    const onPaginationChange = vi.fn();
    const data = input.data ?? Array.from({ length: 3 }, () => buildNotificationChannel());

    render(
      <NotificationChannelsListView
        data={data}
        pagination={{ page: input.page ?? 1, limit: 10, total: input.total ?? data.length, totalPages: input.totalPages ?? 1 }}
        isLoading={input.isLoading ?? false}
        isError={input.isError ?? false}
        removingIds={input.removingIds ?? new Set()}
        onRemove={onRemove}
        onPaginationChange={onPaginationChange}
        dependencies={{ ...DEPENDENCIES, CustomPagination, NotificationChannelDialog }}
      />
    );

    return { onRemove, onPaginationChange, CustomPagination, NotificationChannelDialog };
  }
});
