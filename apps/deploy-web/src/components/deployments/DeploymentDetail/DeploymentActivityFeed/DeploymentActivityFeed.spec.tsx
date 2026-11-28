import { describe, expect, it, vi } from "vitest";

import type { OrganizationActivitiesFeed } from "@src/queries/useOrganizationActivitiesQuery";
import type { OrganizationActivity } from "@src/types/organization-activity";
import type { DEPENDENCIES } from "./DeploymentActivityFeed";
import { DeploymentActivityFeed } from "./DeploymentActivityFeed";

import { render, screen } from "@testing-library/react";

describe("DeploymentActivityFeed", () => {
  it("reads the activity of its deployment only", () => {
    const { useOrganizationActivitiesQuery } = setup();

    expect(useOrganizationActivitiesQuery).toHaveBeenCalledWith({ dseq: "1786440078202" });
  });

  it("hands the feed its activities without naming their project", () => {
    const activities = [activity("a1"), activity("a2")];
    const { RecentActivityFeed, feed } = setup({ feed: { activities, hasMore: true, isError: true } });

    expect(RecentActivityFeed.mock.lastCall?.[0]).toEqual({
      activities,
      projects: [],
      hasMore: true,
      onShowMore: feed.showMore,
      isError: true,
      onRetry: feed.retry,
      showsProjects: false
    });
  });

  it("holds its place while the activity loads", () => {
    const { RecentActivityFeed } = setup({ feed: { isLoading: true } });

    expect(screen.getByTestId("deployment-activity-skeleton")).toBeInTheDocument();
    expect(RecentActivityFeed).not.toHaveBeenCalled();
  });

  function setup(input: { feed?: Partial<OrganizationActivitiesFeed> } = {}) {
    const feed: OrganizationActivitiesFeed = {
      activities: [],
      isLoading: false,
      isError: false,
      hasMore: false,
      showMore: vi.fn(),
      retry: vi.fn(),
      ...input.feed
    };
    const useOrganizationActivitiesQuery = vi.fn((_params?: { dseq?: string }) => feed);
    const RecentActivityFeed = vi.fn<typeof DEPENDENCIES.RecentActivityFeed>(() => <section>feed</section>);

    render(<DeploymentActivityFeed dseq="1786440078202" dependencies={{ useOrganizationActivitiesQuery, RecentActivityFeed }} />);

    return { useOrganizationActivitiesQuery, RecentActivityFeed, feed };
  }

  function activity(id: string): OrganizationActivity {
    return { id, projectId: null, actor: null, type: "deployment_updated", payload: { dseq: "1786440078202" }, createdAt: "2026-01-01T00:00:00.000Z" };
  }
});
