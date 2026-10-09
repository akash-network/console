import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Activity } from "@src/queries/useLatestActivitiesQuery";
import type { DEPENDENCIES } from "./RecentActivity";
import { RecentActivity } from "./RecentActivity";

import { render, screen, within } from "@testing-library/react";
import { buildActivity } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";

describe(RecentActivity.name, () => {
  it("renders nothing while the activity center is off", () => {
    const { useActivityFeedQuery } = setup({ isEnabled: false });

    expect(screen.queryByRole("complementary", { name: "Recent activity" })).not.toBeInTheDocument();
    expect(useActivityFeedQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("renders nothing for a signed-out visitor", () => {
    const { useActivityFeedQuery } = setup({ isSignedIn: false });

    expect(screen.queryByRole("complementary", { name: "Recent activity" })).not.toBeInTheDocument();
    expect(useActivityFeedQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("reads the feed the activity host polls once the activity center is on", () => {
    const { useActivityFeedQuery } = setup({});

    expect(screen.getByRole("complementary", { name: "Recent activity" })).toBeInTheDocument();
    expect(useActivityFeedQuery).toHaveBeenCalledWith({ enabled: true });
  });

  it("lists recent entries newest first, each named after its deployment", () => {
    const { useDeploymentNames } = setup({
      activities: [buildActivity({ status: "succeeded", meta: { dseq: "1" } }), buildActivity({ status: "pending", meta: { dseq: "2" } })],
      names: { "1": "web-api" }
    });

    const entries = entryLinks();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent("Closed “web-api”");
    expect(entries[1]).toHaveTextContent("Closing deployment 2");
    expect(useDeploymentNames).toHaveBeenCalledWith(["1", "2"]);
  });

  it("shows a spinner on an entry still running and none on a finished one", () => {
    setup({ activities: [buildActivity({ status: "pending" }), buildActivity({ status: "succeeded" })] });

    const [running, finished] = entryLinks();
    expect(within(running).getByRole("status")).toBeInTheDocument();
    expect(within(finished).queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows how long ago each entry happened", () => {
    setup({ activities: [buildActivity({ status: "succeeded", createdAt: new Date(Date.now() - 5 * 60_000).toISOString() })] });

    expect(entryLinks()[0]).toHaveTextContent("5 minutes ago");
  });

  it("settles a running entry on its own once the feed reports how it ended", () => {
    const running = buildActivity({ status: "pending", meta: { dseq: "1" } });
    const { showFeed } = setup({ activities: [running] });

    showFeed([{ ...running, status: "succeeded" }]);

    const [entry] = entryLinks();
    expect(entry).toHaveTextContent("Closed deployment 1");
    expect(within(entry).queryByRole("status")).not.toBeInTheDocument();
  });

  it("opens a finished close on its deployment, where its toast leads", () => {
    setup({ activities: [buildActivity({ status: "succeeded", meta: { dseq: "1" } })] });

    expect(entryLinks()[0]).toHaveAttribute("href", "/deployments/1");
  });

  it("opens a close still running on its deployment", () => {
    setup({ activities: [buildActivity({ status: "pending", meta: { dseq: "1" } })] });

    expect(entryLinks()[0]).toHaveAttribute("href", "/deployments/1");
  });

  it("shows why a close failed and opens the Settings tab where it can be closed again", () => {
    setup({
      activities: [buildActivity({ status: "failed", meta: { dseq: "1", error: { code: "close_incomplete", message: "The deployment is still open." } } })]
    });

    const [entry] = entryLinks();
    expect(entry).toHaveTextContent("Couldn't close deployment 1");
    expect(entry).toHaveTextContent("The deployment is still open.");
    expect(entry).toHaveAttribute("href", "/deployments/1?tab=SETTINGS");
  });

  it("sums up a bulk close in one entry that opens the deployments list", () => {
    setup({
      activities: [
        buildActivity({ status: "succeeded", meta: { dseq: "1", batchId: "batch-1" } }),
        buildActivity({ status: "succeeded", meta: { dseq: "2", batchId: "batch-1" } })
      ]
    });

    const entries = entryLinks();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toHaveTextContent("Closed 2 deployments");
    expect(entries[0]).toHaveAttribute("href", "/deployments");
  });

  it("lists at most 8 entries", () => {
    setup({ activities: Array.from({ length: 9 }, () => buildActivity()) });

    expect(entryLinks()).toHaveLength(8);
  });

  it("leads to the full activity history", () => {
    setup({ activities: [buildActivity()] });

    expect(screen.getByRole("link", { name: "Show more" })).toHaveAttribute("href", "/activity");
  });

  it("says so when there is no activity yet, with nothing more to show", () => {
    setup({ activities: [] });

    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(screen.getByText("When you close a deployment, you can follow how it goes here.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Show more" })).not.toBeInTheDocument();
  });

  it("shows it is loading before the feed first answers", () => {
    setup({ feed: "loading" });

    expect(screen.getByRole("status", { name: "Loading activity" })).toBeInTheDocument();
    expect(screen.queryByText("No activity yet")).not.toBeInTheDocument();
  });

  it("says the feed could not be loaded rather than that there is no activity", () => {
    setup({ feed: "failed" });

    expect(screen.getByText("Couldn't load your activity")).toBeInTheDocument();
    expect(screen.getByText("Try again in a moment.")).toBeInTheDocument();
    expect(screen.queryByText("No activity yet")).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading activity" })).not.toBeInTheDocument();
  });

  it("keeps listing the entries it has when a later refresh fails", () => {
    setup({ activities: [buildActivity({ status: "succeeded", meta: { dseq: "1" } })], isRefreshFailing: true });

    expect(entryLinks()[0]).toHaveTextContent("Closed deployment 1");
    expect(screen.queryByText("Couldn't load your activity")).not.toBeInTheDocument();
  });

  function entryLinks() {
    return screen.queryAllByRole("listitem").map(item => within(item).getByRole("link"));
  }

  function setup(input: {
    isEnabled?: boolean;
    isSignedIn?: boolean;
    activities?: Activity[];
    names?: Record<string, string>;
    feed?: "loading" | "failed";
    isRefreshFailing?: boolean;
  }) {
    let activities = input.activities ?? [buildActivity()];
    const useDeploymentNames = vi.fn((() =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentNames>>({
        getDeploymentName: dseq => input.names?.[String(dseq)] ?? null,
        isLoading: false
      })) as typeof DEPENDENCIES.useDeploymentNames);
    const useActivityFeedQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useActivityFeedQuery>>(), {
        data: input.feed ? undefined : { activities, unseenCount: 0 },
        isError: input.feed === "failed" || !!input.isRefreshFailing
      })) as typeof DEPENDENCIES.useActivityFeedQuery);

    const dependencies: typeof DEPENDENCIES = {
      useFlag: flag => flag === "notifications_activity_center" && (input.isEnabled ?? true),
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : buildUser() }),
      useActivityFeedQuery,
      useDeploymentNames
    };

    const { rerender } = render(<RecentActivity dependencies={dependencies} />);

    function showFeed(nextActivities: Activity[]) {
      activities = nextActivities;
      rerender(<RecentActivity dependencies={dependencies} />);
    }

    return { useActivityFeedQuery, useDeploymentNames, showFeed };
  }
});
