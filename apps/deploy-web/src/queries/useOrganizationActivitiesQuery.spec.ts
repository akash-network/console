import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import type { OrganizationActivity } from "@src/types/organization-activity";
import { ACTIVITY_PAGE_SIZE, useDeploymentCreationQuery, useOrganizationActivitiesQuery } from "./useOrganizationActivitiesQuery";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe(useOrganizationActivitiesQuery.name, () => {
  it("reads the first page of the organization's activity", async () => {
    const { result, listOrganizationActivities } = setup({ pages: [{ data: [activity("a1")], nextCursor: null }] });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listOrganizationActivities).toHaveBeenCalledWith({ limit: ACTIVITY_PAGE_SIZE });
    expect(result.current.activities.map(item => item.id)).toEqual(["a1"]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("narrows the feed to one project", async () => {
    const { result, listOrganizationActivities } = setup({ projectId: "p1", pages: [{ data: [], nextCursor: null }] });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listOrganizationActivities).toHaveBeenCalledWith({ projectId: "p1", limit: ACTIVITY_PAGE_SIZE });
  });

  it("narrows the feed to one deployment", async () => {
    const { result, listOrganizationActivities } = setup({ dseq: "1786440078202", pages: [{ data: [], nextCursor: null }] });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(listOrganizationActivities).toHaveBeenCalledWith({ dseq: "1786440078202", limit: ACTIVITY_PAGE_SIZE });
  });

  it("reads the next page from the cursor the last one handed out", async () => {
    const { result, listOrganizationActivities } = setup({
      pages: [
        { data: [activity("a1")], nextCursor: "c2" },
        { data: [activity("a2")], nextCursor: null }
      ]
    });

    await waitFor(() => expect(result.current.hasMore).toBe(true));
    act(() => result.current.showMore());
    await waitFor(() => expect(result.current.activities).toHaveLength(2));

    expect(listOrganizationActivities).toHaveBeenLastCalledWith({ limit: ACTIVITY_PAGE_SIZE, cursor: "c2" });
    expect(result.current.activities.map(item => item.id)).toEqual(["a1", "a2"]);
    expect(result.current.hasMore).toBe(false);
  });

  it("reads the next page once when more is asked for again while it loads", async () => {
    const { result, listOrganizationActivities } = setup({
      pages: [
        { data: [activity("a1")], nextCursor: "c2" },
        { data: [activity("a2")], nextCursor: null }
      ]
    });

    await waitFor(() => expect(result.current.hasMore).toBe(true));
    act(() => {
      result.current.showMore();
      result.current.showMore();
    });
    await waitFor(() => expect(result.current.activities).toHaveLength(2));

    expect(listOrganizationActivities).toHaveBeenCalledTimes(2);
  });

  it("reports a feed it could not read, and reads it again on retry", async () => {
    const { result, listOrganizationActivities } = setup({ pages: [], fails: true });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.activities).toEqual([]);

    act(() => result.current.retry());

    await waitFor(() => expect(listOrganizationActivities).toHaveBeenCalledTimes(2));
  });

  function setup(input: { projectId?: string; dseq?: string; pages: { data: OrganizationActivity[]; nextCursor: string | null }[]; fails?: boolean }) {
    const pages = [...input.pages];
    const listOrganizationActivities = vi.fn(async (_params: unknown) => {
      if (input.fails) throw new Error("boom");
      return pages.shift();
    });
    const api = createProxy({ v1: { listOrganizationActivities } }) as unknown as ApiService;
    const hook = setupQuery(
      () => useOrganizationActivitiesQuery(input.projectId || input.dseq ? { projectId: input.projectId, dseq: input.dseq } : undefined),
      {
        services: { api: () => api }
      }
    );

    return { ...hook, listOrganizationActivities };
  }

  function activity(id: string): OrganizationActivity {
    return { id, projectId: null, actor: null, type: "organization_created", payload: {}, createdAt: "2026-01-01T00:00:00.000Z" };
  }
});

describe(useDeploymentCreationQuery.name, () => {
  it("reads who deployed it and when off its creation activity", async () => {
    const actor = { id: "u1", username: "lena" };
    const { result, listOrganizationActivities } = setup({
      data: [{ id: "a1", projectId: null, actor, type: "deployment_created", payload: { dseq: "1786440078202" }, createdAt: "2026-11-20T10:00:00.000Z" }]
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(listOrganizationActivities).toHaveBeenCalledWith({ dseq: "1786440078202", type: "deployment_created", limit: 1 });
    expect(result.current.data).toEqual({ actor, createdAt: "2026-11-20T10:00:00.000Z" });
  });

  it("reads no creation for a deployment the console recorded none of", async () => {
    const { result } = setup({ data: [] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });

  it("reads nothing while disabled", async () => {
    const { listOrganizationActivities } = setup({ data: [], enabled: false });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(listOrganizationActivities).not.toHaveBeenCalled();
  });

  function setup(input: { data: OrganizationActivity[]; enabled?: boolean }) {
    const listOrganizationActivities = vi.fn(async (_params: unknown) => ({ data: input.data, nextCursor: null }));
    const api = createProxy({ v1: { listOrganizationActivities } }) as unknown as ApiService;
    const hook = setupQuery(() => useDeploymentCreationQuery("1786440078202", input.enabled === undefined ? undefined : { enabled: input.enabled }), {
      services: { api: () => api }
    });

    return { ...hook, listOrganizationActivities };
  }
});
