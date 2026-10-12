import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { AppDIContainer } from "@src/context/ServicesProvider/ServicesProvider";
import type { Activity, ActivityOfAnyType } from "@src/queries/useLatestActivitiesQuery";
import { createApiSdk } from "@src/services/api-sdk/createApiSdk";
import { ActivityBell, DEPENDENCIES } from "./ActivityBell";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildActivity, buildActivityOfUnknownType } from "@tests/seeders/activity";
import { buildUser } from "@tests/seeders/user";
import { jsonResponse } from "@tests/unit/jsonResponse";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(ActivityBell.name, () => {
  it("renders nothing while the activity center is off", () => {
    const { useActivityFeedQuery } = setup({ isEnabled: false });

    expect(screen.queryByRole("button", { name: /activity/i })).not.toBeInTheDocument();
    expect(useActivityFeedQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("renders nothing for a signed-out visitor", () => {
    setup({ isSignedIn: false });

    expect(screen.queryByRole("button", { name: /activity/i })).not.toBeInTheDocument();
  });

  it("shows how many entries the user hasn't seen", () => {
    setup({ unseenCount: 3 });

    expect(screen.getByRole("button", { name: "Activity, 3 unseen" })).toHaveTextContent("3");
  });

  it("shows a count of 9 as it is", () => {
    setup({ unseenCount: 9 });

    expect(screen.getByRole("button", { name: "Activity, 9 unseen" })).toHaveTextContent(/^9$/);
  });

  it("caps the count it shows at 9+", () => {
    setup({ unseenCount: 12 });

    expect(screen.getByRole("button", { name: "Activity, 12 unseen" })).toHaveTextContent("9+");
  });

  it("shows no count once everything is seen", () => {
    setup({ unseenCount: 0 });

    expect(screen.getByRole("button", { name: "Activity" })).toHaveTextContent("");
  });

  it("lists recent entries newest first, each linking to the deployment it is about", async () => {
    const { useDeploymentNames } = setup({
      activities: [buildActivity({ status: "succeeded", meta: { dseq: "1" } }), buildActivity({ status: "pending", meta: { dseq: "2" } })],
      names: { "1": "web-api" }
    });

    await open();

    expect(useDeploymentNames).toHaveBeenCalledWith(["1", "2"]);
    const entries = entryItems();
    expect(entries.map(entry => entry.getAttribute("href"))).toEqual(["/deployments/1", "/deployments/2"]);
    expect(entries[0]).toHaveTextContent("Closed “web-api”");
    expect(entries[1]).toHaveTextContent("Closing deployment 2");
  });

  it("shows a spinner on an entry still running", async () => {
    setup({ activities: [buildActivity({ status: "pending", meta: { dseq: "2" } })] });

    await open();

    expect(within(entryItems()[0]).getByRole("status")).toBeInTheDocument();
  });

  it("shows why an entry failed and links it to where the deployment can be closed again", async () => {
    setup({
      activities: [buildActivity({ status: "failed", meta: { dseq: "1", error: { code: "close_incomplete", message: "The deployment is still open." } } })]
    });

    await open();

    const [entry] = entryItems();
    expect(entry).toHaveTextContent("Couldn't close deployment 1");
    expect(entry).toHaveTextContent("The deployment is still open.");
    expect(entry).toHaveAttribute("href", "/deployments/1?tab=SETTINGS");
  });

  it("links a bulk close to the deployments list", async () => {
    setup({
      activities: [
        buildActivity({ status: "succeeded", meta: { dseq: "1", batchId: "batch-1" } }),
        buildActivity({ status: "failed", meta: { dseq: "2", batchId: "batch-1" } })
      ]
    });

    await open();

    const [entry] = entryItems();
    expect(entry).toHaveTextContent("Closed 1 of 2 deployments");
    expect(entry).toHaveAttribute("href", "/deployments");
  });

  it("shows how long ago each entry happened", async () => {
    setup({ activities: [buildActivity({ status: "succeeded", createdAt: new Date(Date.now() - 5 * 60_000).toISOString() })] });

    await open();

    expect(entryItems()[0]).toHaveTextContent("5 minutes ago");
  });

  it("lists at most 10 entries", async () => {
    setup({ activities: Array.from({ length: 12 }, () => buildActivity()) });

    await open();

    expect(entryItems()).toHaveLength(10);
  });

  it("says so when there is no activity yet", async () => {
    setup({ activities: [] });

    await open();

    expect(screen.getByText("No activity yet")).toBeInTheDocument();
    expect(entryItems()).toHaveLength(0);
  });

  it("shows it is loading before the feed first answers", async () => {
    setup({ feed: "loading" });

    await open();

    expect(screen.getByRole("status", { name: "Loading activity" })).toBeInTheDocument();
    expect(screen.queryByText("No activity yet")).not.toBeInTheDocument();
  });

  it("says the feed could not be loaded rather than that there is no activity", async () => {
    setup({ feed: "failed" });

    await open();

    expect(screen.getByText("Couldn't load your activity")).toBeInTheDocument();
    expect(screen.queryByText("No activity yet")).not.toBeInTheDocument();
  });

  it("keeps listing the entries it has when a later refresh fails", async () => {
    setup({ activities: [buildActivity({ status: "succeeded", meta: { dseq: "1" } })], isRefreshFailing: true });

    await open();

    expect(entryItems()[0]).toHaveTextContent("Closed deployment 1");
    expect(screen.queryByText("Couldn't load your activity")).not.toBeInTheDocument();
  });

  it("links to the full activity history", async () => {
    setup({ activities: [buildActivity()] });

    await open();

    expect(screen.getByRole("menuitem", { name: "See all activity" })).toHaveAttribute("href", "/activity");
  });

  it("marks everything up to the newest entry seen once opened", async () => {
    const newest = buildActivity({ createdAt: "2026-10-08T10:00:00.000Z" });
    const { markSeen } = setup({ activities: [newest, buildActivity({ createdAt: "2026-10-08T09:00:00.000Z" })], unseenCount: 2 });

    await open();

    expect(markSeen).toHaveBeenCalledWith({ data: { upTo: "2026-10-08T10:00:00.000Z" } });
  });

  it("marks seen up to the newest activity of the feed, past the entries it doesn't list", async () => {
    const { markSeen } = setup({
      activities: [buildActivity({ createdAt: "2026-10-08T10:00:00.000Z" })],
      newestCreatedAt: "2026-10-08T11:00:00.000Z",
      unseenCount: 2
    });

    await open();

    expect(markSeen).toHaveBeenCalledWith({ data: { upTo: "2026-10-08T11:00:00.000Z" } });
  });

  it("marks nothing when the feed has no activity to mark up to", async () => {
    const { markSeen } = setup({ activities: [], unseenCount: 1 });

    await open();

    expect(markSeen).not.toHaveBeenCalled();
  });

  it("marks nothing when opened with nothing unseen", async () => {
    const { markSeen } = setup({ activities: [buildActivity()], unseenCount: 0 });

    await open();

    expect(markSeen).not.toHaveBeenCalled();
  });

  it("refreshes the feed once entries are marked seen", () => {
    const { api, queryClient } = setup({});

    api.v1.markActivitiesSeen.useMutation.mock.calls.at(-1)?.[0]?.onSuccess?.(mock(), mock(), mock());

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["listActivities"] });
  });

  describe("with a feed carrying a type it doesn't know yet", () => {
    it("lists only the entries it knows", async () => {
      setupFeed({
        activities: [
          buildActivityOfUnknownType({ status: "succeeded", meta: { dseq: "9999" } }),
          buildActivity({ status: "succeeded", meta: { dseq: "1234" } })
        ],
        unseenCount: 2
      });

      await open();

      await waitFor(() => expect(entryItems()).toHaveLength(1));
      expect(entryItems()[0]).toHaveTextContent("Closed deployment 1234");
      expect(entryItems()[0]).toHaveAttribute("href", "/deployments/1234");
    });

    it("marks the entries it skips seen too once opened, so the count can clear", async () => {
      const { fetch } = setupFeed({
        activities: [buildActivityOfUnknownType({ createdAt: "2026-10-12T10:00:00.000Z" }), buildActivity({ createdAt: "2026-10-12T09:00:00.000Z" })],
        unseenCount: 2
      });

      await userEvent.click(await screen.findByRole("button", { name: "Activity, 2 unseen" }));

      await waitFor(() => expect(seenRequestsOf(fetch)).toEqual([{ data: { upTo: "2026-10-12T10:00:00.000Z" } }]));
    });

    function seenRequestsOf(fetch: ReturnType<typeof setupFeed>["fetch"]) {
      return fetch.mock.calls.filter(([url]) => String(url).endsWith("/v1/activities/seen")).map(([, init]) => JSON.parse(String(init?.body)));
    }

    function setupFeed(input: { activities: ActivityOfAnyType[]; unseenCount: number }) {
      const feed = { data: { activities: input.activities, unseenCount: input.unseenCount, pagination: { limit: 100, hasMore: false, nextCursor: null } } };
      const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => jsonResponse(feed));

      const dependencies: typeof DEPENDENCIES = {
        useFlag: () => true,
        useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: buildUser() }),
        useActivityFeedQuery: DEPENDENCIES.useActivityFeedQuery,
        useDeploymentNames: () => mock<ReturnType<typeof DEPENDENCIES.useDeploymentNames>>({ getDeploymentName: () => null, isLoading: false }),
        useQueryClient: () => mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>()
      };

      render(
        <TestContainerProvider services={{ api: () => createProxy(createApiSdk({ baseUrl: "", fetch })) }}>
          <ActivityBell dependencies={dependencies} />
        </TestContainerProvider>
      );

      return { fetch };
    }
  });

  function entryItems() {
    return screen.queryAllByRole("menuitem").filter(item => item.textContent !== "See all activity");
  }

  async function open() {
    await userEvent.click(screen.getByRole("button", { name: /^Activity/ }));
  }

  function setup(input: {
    isEnabled?: boolean;
    isSignedIn?: boolean;
    activities?: Activity[];
    unseenCount?: number;
    newestCreatedAt?: string;
    names?: Record<string, string>;
    feed?: "loading" | "failed";
    isRefreshFailing?: boolean;
  }) {
    const markSeen = vi.fn();
    const queryClient = mock<ReturnType<typeof DEPENDENCIES.useQueryClient>>();
    const api = mockDeep<AppDIContainer["api"]>();
    api.v1.listActivities.getKey.mockReturnValue(["listActivities"]);
    api.v1.markActivitiesSeen.useMutation.mockReturnValue(mock<ReturnType<typeof api.v1.markActivitiesSeen.useMutation>>({ mutate: markSeen }));
    const useDeploymentNames = vi.fn((() =>
      mock<ReturnType<typeof DEPENDENCIES.useDeploymentNames>>({
        getDeploymentName: dseq => input.names?.[String(dseq)] ?? null,
        isLoading: false
      })) as typeof DEPENDENCIES.useDeploymentNames);
    const activities = input.activities ?? [buildActivity()];
    const useActivityFeedQuery = vi.fn((() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useActivityFeedQuery>>(), {
        data: input.feed ? undefined : { activities, unseenCount: input.unseenCount ?? 0, newestCreatedAt: input.newestCreatedAt ?? activities[0]?.createdAt },
        isError: input.feed === "failed" || !!input.isRefreshFailing
      })) as typeof DEPENDENCIES.useActivityFeedQuery);

    const dependencies: typeof DEPENDENCIES = {
      useFlag: flag => flag === "notifications_activity_center" && (input.isEnabled ?? true),
      useUser: () => mock<ReturnType<typeof DEPENDENCIES.useUser>>({ user: input.isSignedIn === false ? undefined : buildUser() }),
      useActivityFeedQuery,
      useDeploymentNames,
      useQueryClient: () => queryClient
    };

    render(
      <TestContainerProvider services={{ api: () => api }}>
        <ActivityBell dependencies={dependencies} />
      </TestContainerProvider>
    );

    return { markSeen, api, queryClient, useActivityFeedQuery, useDeploymentNames };
  }
});
