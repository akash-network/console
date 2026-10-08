import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { DEPENDENCIES } from "./ActivityHistoryPage";
import { ActivityHistoryPage } from "./ActivityHistoryPage";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildActivity } from "@tests/seeders/activity";

describe(ActivityHistoryPage.name, () => {
  it("lists the user's activity newest first, each linking to the deployment it is about", () => {
    const { useDeploymentNames } = setup({
      pages: {
        first: { activities: [buildActivity({ status: "succeeded", meta: { dseq: "1" } }), buildActivity({ status: "pending", meta: { dseq: "2" } })] }
      },
      names: { "1": "web-api" }
    });

    const entries = entryItems();
    expect(entries.map(entry => within(entry).getByRole("link").getAttribute("href"))).toEqual(["/deployments/1", "/deployments/2"]);
    expect(entries[0]).toHaveTextContent("Closed “web-api”");
    expect(entries[1]).toHaveTextContent("Closing deployment 2");
    expect(useDeploymentNames).toHaveBeenCalledWith(["1", "2"]);
  });

  it("shows a spinner on an entry still running", () => {
    setup({ pages: { first: { activities: [buildActivity({ status: "pending" })] } } });

    expect(within(entryItems()[0]).getByRole("status")).toBeInTheDocument();
  });

  it("shows why an entry failed and links it to where the deployment can be closed again", () => {
    setup({
      pages: {
        first: {
          activities: [buildActivity({ status: "failed", meta: { dseq: "1", error: { code: "close_incomplete", message: "The deployment is still open." } } })]
        }
      }
    });

    const [entry] = entryItems();
    expect(entry).toHaveTextContent("Couldn't close deployment 1");
    expect(entry).toHaveTextContent("The deployment is still open.");
    expect(within(entry).getByRole("link")).toHaveAttribute("href", "/deployments/1?tab=SETTINGS");
  });

  it("shows how long ago each entry happened", () => {
    setup({ pages: { first: { activities: [buildActivity({ status: "succeeded", createdAt: new Date(Date.now() - 5 * 60_000).toISOString() })] } } });

    expect(entryItems()[0]).toHaveTextContent("5 minutes ago");
  });

  it("lists each close of a bulk close on its own, so each outcome can be checked", () => {
    setup({
      pages: {
        first: {
          activities: [
            buildActivity({ status: "succeeded", meta: { dseq: "1", batchId: "batch-1" } }),
            buildActivity({ status: "failed", meta: { dseq: "2", batchId: "batch-1" } })
          ]
        }
      }
    });

    const entries = entryItems();
    expect(entries[0]).toHaveTextContent("Closed deployment 1");
    expect(entries[1]).toHaveTextContent("Couldn't close deployment 2");
  });

  it("filters to entries still in progress", async () => {
    const { useActivityHistoryQuery } = setup({});

    await choose("Status", "In progress");

    expect(useActivityHistoryQuery).toHaveBeenLastCalledWith({ status: "pending", type: undefined, cursor: undefined });
  });

  it("filters to failed entries of one type, both filters together", async () => {
    const { useActivityHistoryQuery } = setup({});

    await choose("Status", "Failed");
    await choose("Action", "Deployment closes");

    expect(useActivityHistoryQuery).toHaveBeenLastCalledWith({ status: "failed", type: "deployment_close", cursor: undefined });
    expect(screen.getByRole("combobox", { name: "Action" })).toHaveTextContent("Deployment closes");
  });

  it("goes back to every entry once a filter is cleared", async () => {
    const { useActivityHistoryQuery } = setup({});
    await choose("Status", "Succeeded");

    await choose("Status", "All statuses");

    expect(useActivityHistoryQuery).toHaveBeenLastCalledWith({ status: undefined, type: undefined, cursor: undefined });
  });

  it("goes back to every action once the action filter is cleared", async () => {
    const { useActivityHistoryQuery } = setup({});
    await choose("Action", "Deployment closes");

    await choose("Action", "All actions");

    expect(useActivityHistoryQuery).toHaveBeenLastCalledWith({ status: undefined, type: undefined, cursor: undefined });
    expect(screen.getByRole("combobox", { name: "Action" })).toHaveTextContent("All actions");
  });

  it("pages back through older entries and returns", async () => {
    const { useActivityHistoryQuery } = setup({
      pages: {
        first: { activities: [buildActivity({ meta: { dseq: "1" } })], nextCursor: "cursor-2" },
        "cursor-2": { activities: [buildActivity({ meta: { dseq: "2" } })], nextCursor: "cursor-3" }
      }
    });

    await userEvent.click(screen.getByRole("link", { name: "Go to next page" }));
    expect(useActivityHistoryQuery).toHaveBeenLastCalledWith({ status: undefined, type: undefined, cursor: "cursor-2" });
    expect(entryItems()[0]).toHaveTextContent("deployment 2");

    await userEvent.click(screen.getByRole("link", { name: "Go to previous page" }));
    expect(useActivityHistoryQuery).toHaveBeenLastCalledWith({ status: undefined, type: undefined, cursor: undefined });
  });

  it("starts again from the newest entries when a filter changes", async () => {
    const { useActivityHistoryQuery } = setup({ pages: { first: { activities: [buildActivity()], nextCursor: "cursor-2" } } });
    await userEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    await choose("Status", "Failed");

    expect(useActivityHistoryQuery).toHaveBeenLastCalledWith({ status: "failed", type: undefined, cursor: undefined });
  });

  it("offers no earlier page from the first one", () => {
    setup({ pages: { first: { activities: [buildActivity()], nextCursor: "cursor-2" } } });

    expect(screen.getByRole("link", { name: "Go to previous page" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Go to next page" })).toHaveAttribute("aria-disabled", "false");
  });

  it("offers no later page from the last one", async () => {
    setup({ pages: { first: { activities: [buildActivity()], nextCursor: "cursor-2" }, "cursor-2": { activities: [buildActivity()], nextCursor: null } } });

    await userEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(screen.getByRole("link", { name: "Go to next page" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Go to previous page" })).toHaveAttribute("aria-disabled", "false");
  });

  it("holds both paging controls while the page it moved to is still loading", async () => {
    setup({
      pages: {
        first: { activities: [buildActivity()], nextCursor: "cursor-2" },
        "cursor-2": { activities: [buildActivity()], nextCursor: "cursor-2", isPlaceholderData: true }
      }
    });

    await userEvent.click(screen.getByRole("link", { name: "Go to next page" }));

    expect(screen.getByRole("link", { name: "Go to next page" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "Go to previous page" })).toHaveAttribute("aria-disabled", "true");
  });

  it("leaves paging out while everything fits on one page", () => {
    setup({ pages: { first: { activities: [buildActivity()], nextCursor: null } } });

    expect(screen.queryByRole("navigation", { name: "pagination" })).not.toBeInTheDocument();
  });

  it("says there is no activity yet when the user has none", () => {
    setup({ pages: { first: { activities: [] } } });

    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Activity" })).not.toBeInTheDocument();
  });

  it("says nothing matches when the filters leave no entry", async () => {
    setup({ pages: { first: { activities: [buildActivity()] }, failed: { activities: [] } } });

    await choose("Status", "Failed");

    expect(screen.getByText("No activity matches these filters")).toBeInTheDocument();
  });

  it("says nothing matches when the action filter alone leaves no entry", async () => {
    setup({ pages: { first: { activities: [buildActivity()] }, deployment_close: { activities: [] } } });

    await choose("Action", "Deployment closes");

    expect(screen.getByText("No activity matches these filters")).toBeInTheDocument();
  });

  it("shows it is loading before the first page answers", () => {
    setup({ pages: {}, isLoading: true });

    expect(screen.getByRole("status", { name: "Loading activity" })).toBeInTheDocument();
    expect(screen.queryByText("No activity yet")).not.toBeInTheDocument();
  });

  it("says the activity could not be loaded and offers to try again", async () => {
    const { refetch } = setup({ pages: {}, isError: true });

    expect(screen.getByText("Couldn't load your activity")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(refetch).toHaveBeenCalled();
  });

  function entryItems() {
    return within(screen.getByRole("list", { name: "Activity" })).getAllByRole("listitem");
  }

  async function choose(filter: string, option: string) {
    await userEvent.click(screen.getByRole("combobox", { name: filter }));
    await userEvent.click(screen.getByRole("option", { name: option }));
  }

  function setup(input: {
    pages?: Record<string, { activities: Activity[]; nextCursor?: string | null; isPlaceholderData?: boolean }>;
    names?: Record<string, string>;
    isLoading?: boolean;
    isError?: boolean;
  }) {
    const pages = input.pages ?? { first: { activities: [buildActivity()] } };
    const refetch = vi.fn();
    const useActivityHistoryQuery = vi.fn(((filters: Parameters<typeof DEPENDENCIES.useActivityHistoryQuery>[0]) => {
      const page = pages[filters.cursor ?? filters.status ?? filters.type ?? "first"] ?? pages.first;
      return Object.assign(mock<ReturnType<typeof DEPENDENCIES.useActivityHistoryQuery>>(), {
        data: page && { activities: page.activities, nextCursor: page.nextCursor ?? null },
        isLoading: input.isLoading ?? false,
        isPlaceholderData: page?.isPlaceholderData ?? false,
        isError: input.isError ?? false,
        refetch
      });
    }) as typeof DEPENDENCIES.useActivityHistoryQuery);
    const useDeploymentNames = vi.fn((() =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentNames>>({
        getDeploymentName: dseq => input.names?.[String(dseq)] ?? null,
        isLoading: false
      })) as typeof DEPENDENCIES.useDeploymentNames);

    const dependencies: typeof DEPENDENCIES = {
      Layout: ({ children }) => <>{children}</>,
      useActivityHistoryQuery,
      useDeploymentNames
    };

    render(<ActivityHistoryPage dependencies={dependencies} />);

    return { useActivityHistoryQuery, useDeploymentNames, refetch };
  }
});
