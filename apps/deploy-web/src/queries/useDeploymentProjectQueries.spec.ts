import { ApiError } from "@akashnetwork/openapi-sdk";
import { createProxy } from "@akashnetwork/react-query-proxy";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  DEPLOYMENT_LOCATION_QUERY_KEY,
  DEPLOYMENTS_LIST_QUERY_KEY,
  invalidateDeploymentMoveQueries,
  useDeploymentLocationQuery,
  useUpdateDeploymentProjectMutation
} from "./useDeploymentProjectQueries";
import { ORGANIZATION_ACTIVITIES_QUERY_KEY } from "./useOrganizationActivitiesQuery";
import { PROJECTS_QUERY_KEY } from "./useProjectsQuery";

import { act, waitFor } from "@testing-library/react";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

const LOCATION = { organizationId: "org-1", organizationSlug: "acme-corp", projectId: "p1" };

describe("useDeploymentProjectQueries", () => {
  describe(useDeploymentLocationQuery.name, () => {
    it("reads where the deployment is filed", async () => {
      const { result, getDeploymentLocation } = setupLocation({});

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getDeploymentLocation).toHaveBeenCalledWith({ dseq: "100" });
      expect(result.current.data).toEqual(LOCATION);
    });

    it("reads a deployment the caller cannot reach as filed nowhere", async () => {
      const { result } = setupLocation({ rejectWith: new ApiError(404, { message: "Deployment not found" }, "not found") });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
    });

    it("reports any other failure", async () => {
      const { result } = setupLocation({ rejectWith: new ApiError(500, { message: "boom" }, "server error") });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("asks for nothing while it is disabled", () => {
      const { result, getDeploymentLocation } = setupLocation({ enabled: false });

      expect(result.current.fetchStatus).toBe("idle");
      expect(getDeploymentLocation).not.toHaveBeenCalled();
    });

    function setupLocation(input: { rejectWith?: unknown; enabled?: boolean }) {
      const getDeploymentLocation = vi.fn(async (_params: unknown) => {
        if (input.rejectWith) throw input.rejectWith;
        return { data: LOCATION };
      });
      const api = createProxy({ v1: { getDeploymentLocation } }) as unknown as ApiService;
      const hook = setupQuery(() => useDeploymentLocationQuery("100", input.enabled === undefined ? undefined : { enabled: input.enabled }), {
        services: { api: () => api }
      });

      return { ...hook, getDeploymentLocation };
    }
  });

  describe(useUpdateDeploymentProjectMutation.name, () => {
    it("moves the deployment and refreshes everything the move changes", async () => {
      const updateDeploymentProject = vi.fn(async () => ({ data: { dseq: "100", projectId: "p2" } }));
      const api = createProxy({ v1: { updateDeploymentProject } }) as unknown as ApiService;
      const queryClient = new QueryClient();
      const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = setupQuery(() => useUpdateDeploymentProjectMutation(), { services: { api: () => api, queryClient: () => queryClient } });

      await act(() => result.current.mutateAsync({ dseq: "100", data: { projectId: "p2" } }));

      expect(updateDeploymentProject).toHaveBeenCalledWith({ dseq: "100", data: { projectId: "p2" } });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: DEPLOYMENTS_LIST_QUERY_KEY });
    });
  });

  describe(invalidateDeploymentMoveQueries.name, () => {
    it("refreshes the lists, locations, projects and activity a move changes", async () => {
      const queryClient = new QueryClient();
      const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

      await invalidateDeploymentMoveQueries(queryClient);

      expect(invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
        DEPLOYMENTS_LIST_QUERY_KEY,
        DEPLOYMENT_LOCATION_QUERY_KEY,
        PROJECTS_QUERY_KEY,
        ORGANIZATION_ACTIVITIES_QUERY_KEY
      ]);
    });
  });
});
