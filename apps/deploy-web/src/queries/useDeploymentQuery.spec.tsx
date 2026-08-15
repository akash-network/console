import { useQueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FallbackableHttpClient } from "@src/services/createFallbackableHttpClient/createFallbackableHttpClient";
import { deploymentToDto } from "@src/utils/deploymentDetailUtils";
import { setupQuery } from "../../tests/unit/query-client";
import { QueryKeys } from "./queryKeys";
import { useDeploymentsPage } from "./useDeploymentQuery";

import { buildRpcDeployment } from "@tests/seeders/deployment";

describe("useDeploymentQuery", () => {
  describe(useDeploymentsPage.name, () => {
    it("returns an empty page when address is not provided", async () => {
      const { result } = setupQuery(() => useDeploymentsPage("", { state: "active", skip: 0, limit: 10 }), {
        services: { chainApiHttpClient: () => mock<FallbackableHttpClient>() }
      });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ deployments: [], hasNextPage: false });
    });

    it("requests a single page filtered by state with offset pagination and no count_total", async () => {
      const { chainApiHttpClient, result } = setup();

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      const requestedUrl = chainApiHttpClient.get.mock.calls[0][0] as string;
      expect(requestedUrl).toContain("filters.owner=test-address");
      expect(requestedUrl).toContain("filters.state=active");
      expect(requestedUrl).toContain("pagination.offset=20");
      expect(requestedUrl).toContain("pagination.limit=10");
      expect(requestedUrl).toContain("pagination.reverse=true");
      expect(requestedUrl).not.toContain("pagination.count_total");
    });

    it("maps deployments to DTOs and treats a next_key as another page", async () => {
      const deployment = buildRpcDeployment({ deployment: { id: { owner: "test-address" }, state: "active" } });
      const { result } = setup({ deployments: [deployment], nextKey: "cursor-1" });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual({
        deployments: [deploymentToDto(deployment)],
        hasNextPage: true
      });
    });

    it("does not treat pagination.total as a real total when next_key is absent", async () => {
      const deployment = buildRpcDeployment({ deployment: { id: { owner: "test-address" }, state: "active" } });
      const { result } = setup({ deployments: [deployment], nextKey: null, total: "10" });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual({
        deployments: [deploymentToDto(deployment)],
        hasNextPage: false
      });
      expect(result.current.data).not.toHaveProperty("total");
    });

    it("treats a missing pagination object as the last page", async () => {
      const { result } = setup({ pagination: null });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual({ deployments: [], hasNextPage: false });
    });

    it("keys pages under the address prefix so deploy-success invalidation refreshes them", () => {
      const prefix = QueryKeys.getDeploymentsPageKeyPrefix("test-address");

      expect(QueryKeys.getDeploymentsPageKey("test-address", "active", 0, 10).slice(0, prefix.length)).toEqual(prefix);
    });

    it("keeps the previous page while paging within a status but drops it across a status change", async () => {
      const { chainApiHttpClient, requestCount, resolveNextPage } = buildDeferredClient();

      let params: Parameters<typeof useDeploymentsPage>[1] = { state: "active", skip: 0, limit: 10 };
      const { result, rerender } = setupQuery(() => useDeploymentsPage("test-address", params), {
        services: { chainApiHttpClient: () => chainApiHttpClient }
      });

      const activePage1 = buildRpcDeployment({ deployment: { id: { owner: "test-address", dseq: "100" }, state: "active" } });
      await vi.waitFor(() => expect(requestCount()).toBe(1));
      resolveNextPage([activePage1], "cursor-1");
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ deployments: [deploymentToDto(activePage1)], hasNextPage: true });

      params = { state: "active", skip: 10, limit: 10 };
      rerender();
      await vi.waitFor(() => {
        expect(requestCount()).toBe(2);
        expect(result.current.isPlaceholderData).toBe(true);
      });
      expect(result.current.data).toEqual({ deployments: [deploymentToDto(activePage1)], hasNextPage: true });

      const activePage2 = buildRpcDeployment({ deployment: { id: { owner: "test-address", dseq: "200" }, state: "active" } });
      resolveNextPage([activePage2], null);
      await vi.waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
      expect(result.current.data).toEqual({ deployments: [deploymentToDto(activePage2)], hasNextPage: false });

      params = { state: "closed", skip: 0, limit: 10 };
      rerender();
      await vi.waitFor(() => {
        expect(requestCount()).toBe(3);
        expect(result.current.isPlaceholderData).toBe(false);
      });
      expect(result.current.data).toBeUndefined();
    });

    it("keys the query by address, state, skip and limit", async () => {
      const { result } = setupQuery(
        () => {
          const page = useDeploymentsPage("test-address", { state: "closed", skip: 30, limit: 10 });
          const queryClient = useQueryClient();
          return { page, queryClient };
        },
        { services: { chainApiHttpClient: () => buildClient() } }
      );

      await vi.waitFor(() => expect(result.current.page.isSuccess).toBe(true));

      const [query] = result.current.queryClient.getQueryCache().findAll();
      expect(query.queryKey).toEqual(QueryKeys.getDeploymentsPageKey("test-address", "closed", 30, 10));
    });

    it("drops the previous page when the address changes even if the status is unchanged", async () => {
      const { chainApiHttpClient, requestCount, resolveNextPage } = buildDeferredClient();

      let address = "address-a";
      const { result, rerender } = setupQuery(() => useDeploymentsPage(address, { state: "active", skip: 0, limit: 10 }), {
        services: { chainApiHttpClient: () => chainApiHttpClient }
      });

      await vi.waitFor(() => expect(requestCount()).toBe(1));
      resolveNextPage([buildRpcDeployment({ deployment: { id: { owner: "address-a", dseq: "1" }, state: "active" } })], null);
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      address = "address-b";
      rerender();

      await vi.waitFor(() => {
        expect(requestCount()).toBe(2);
        expect(result.current.isPlaceholderData).toBe(false);
      });
      expect(result.current.data).toBeUndefined();
    });

    function buildDeferredClient() {
      const resolvers: Array<(value: unknown) => void> = [];
      let resolvedCount = 0;
      const chainApiHttpClient = mock<FallbackableHttpClient>({
        get: vi.fn().mockImplementation(() => new Promise(resolve => resolvers.push(resolve)))
      } as unknown as FallbackableHttpClient);

      return {
        chainApiHttpClient,
        requestCount: () => resolvers.length,
        resolveNextPage: (deployments: ReturnType<typeof buildRpcDeployment>[], nextKey: string | null) => {
          const resolve = resolvers[resolvedCount++];
          if (!resolve) throw new Error("No pending deployments request to resolve");
          resolve({ data: { deployments, pagination: { next_key: nextKey, total: String(deployments.length) } } });
        }
      };
    }

    function buildClient(
      input: {
        deployments?: ReturnType<typeof buildRpcDeployment>[];
        nextKey?: string | null;
        total?: string;
        pagination?: { next_key: string | null; total: string } | null;
      } = {}
    ) {
      const pagination =
        input.pagination === undefined ? { next_key: input.nextKey ?? null, total: input.total ?? String(input.deployments?.length ?? 0) } : input.pagination;

      return mock<FallbackableHttpClient>({
        get: vi.fn().mockResolvedValue({
          data: {
            deployments: input.deployments ?? [],
            pagination
          }
        })
      } as unknown as FallbackableHttpClient);
    }

    function setup(
      input: {
        deployments?: ReturnType<typeof buildRpcDeployment>[];
        nextKey?: string | null;
        total?: string;
        pagination?: { next_key: string | null; total: string } | null;
      } = {}
    ) {
      const chainApiHttpClient = buildClient(input);
      const { result } = setupQuery(() => useDeploymentsPage("test-address", { state: "active", skip: 20, limit: 10 }), {
        services: { chainApiHttpClient: () => chainApiHttpClient }
      });
      return { chainApiHttpClient, result };
    }
  });

  describe(QueryKeys.getDeploymentListKey.name, () => {
    it("keeps the address segment even when the address is empty and state is omitted", () => {
      expect(QueryKeys.getDeploymentListKey("", "active")).toEqual(["DEPLOYMENT_LIST", "", "active"]);
      expect(QueryKeys.getDeploymentListKey("akash1abc")).toEqual(["DEPLOYMENT_LIST", "akash1abc"]);
    });
  });
});
