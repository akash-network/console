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
      const { result } = setupQuery(() => useDeploymentsPage("", { state: "active", skip: 0, limit: 10, countTotal: true }), {
        services: { chainApiHttpClient: () => mock<FallbackableHttpClient>() }
      });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ deployments: [], total: 0 });
    });

    it("requests a single page filtered by state with offset pagination and count_total", async () => {
      const { chainApiHttpClient, result } = setup({ total: 42 });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      const requestedUrl = chainApiHttpClient.get.mock.calls[0][0] as string;
      expect(requestedUrl).toContain("filters.owner=test-address");
      expect(requestedUrl).toContain("filters.state=active");
      expect(requestedUrl).toContain("pagination.offset=20");
      expect(requestedUrl).toContain("pagination.limit=10");
      expect(requestedUrl).toContain("pagination.count_total=true");
      expect(requestedUrl).toContain("pagination.reverse=true");
    });

    it("maps deployments to DTOs and exposes the server total", async () => {
      const deployment = buildRpcDeployment({ deployment: { id: { owner: "test-address" }, state: "active" } });
      const { result } = setup({ total: 42, deployments: [deployment] });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual({
        deployments: [deploymentToDto(deployment)],
        total: 42
      });
    });

    it("omits count_total and leaves total undefined when countTotal is false", async () => {
      const { chainApiHttpClient, result } = setup({ total: 42, countTotal: false });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(chainApiHttpClient.get.mock.calls[0][0]).not.toContain("pagination.count_total");
      expect(result.current.data?.total).toBeUndefined();
    });

    it("keys pages under the address prefix so deploy-success invalidation refreshes them", () => {
      const prefix = QueryKeys.getDeploymentsPageKeyPrefix("test-address");

      expect(QueryKeys.getDeploymentsPageKey("test-address", "active", 0, 10).slice(0, prefix.length)).toEqual(prefix);
    });

    it("keeps the previous page while paging within a status but drops it across a status change", async () => {
      const { chainApiHttpClient, requestCount, resolveNextPage } = buildDeferredClient();

      let params: Parameters<typeof useDeploymentsPage>[1] = { state: "active", skip: 0, limit: 10, countTotal: true };
      const { result, rerender } = setupQuery(() => useDeploymentsPage("test-address", params), {
        services: { chainApiHttpClient: () => chainApiHttpClient }
      });

      const activePage1 = buildRpcDeployment({ deployment: { id: { owner: "test-address", dseq: "100" }, state: "active" } });
      await vi.waitFor(() => expect(requestCount()).toBe(1));
      resolveNextPage([activePage1], 20);
      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ deployments: [deploymentToDto(activePage1)], total: 20 });

      params = { state: "active", skip: 10, limit: 10, countTotal: true };
      rerender();
      await vi.waitFor(() => {
        expect(requestCount()).toBe(2);
        expect(result.current.isPlaceholderData).toBe(true);
      });
      expect(result.current.data).toEqual({ deployments: [deploymentToDto(activePage1)], total: 20 });

      const activePage2 = buildRpcDeployment({ deployment: { id: { owner: "test-address", dseq: "200" }, state: "active" } });
      resolveNextPage([activePage2], 20);
      await vi.waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
      expect(result.current.data).toEqual({ deployments: [deploymentToDto(activePage2)], total: 20 });

      params = { state: "closed", skip: 0, limit: 10, countTotal: true };
      rerender();
      await vi.waitFor(() => {
        expect(requestCount()).toBe(3);
        expect(result.current.isPlaceholderData).toBe(false);
      });
      expect(result.current.data).toBeUndefined();
    });

    it("keys the query by address, state, skip, limit and countTotal", async () => {
      const { result } = setupQuery(
        () => {
          const page = useDeploymentsPage("test-address", { state: "closed", skip: 30, limit: 10, countTotal: true });
          const queryClient = useQueryClient();
          return { page, queryClient };
        },
        { services: { chainApiHttpClient: () => buildClient({ total: 0 }) } }
      );

      await vi.waitFor(() => expect(result.current.page.isSuccess).toBe(true));

      const [query] = result.current.queryClient.getQueryCache().findAll();
      expect(query.queryKey).toEqual(QueryKeys.getDeploymentsPageKey("test-address", "closed", 30, 10, true));
    });

    it("keys totals-bearing and totals-free requests separately so one cannot satisfy the other", () => {
      expect(QueryKeys.getDeploymentsPageKey("test-address", "active", 0, 10, true)).not.toEqual(
        QueryKeys.getDeploymentsPageKey("test-address", "active", 0, 10, false)
      );
    });

    it("drops the previous page when the address changes even if the status is unchanged", async () => {
      const { chainApiHttpClient, requestCount, resolveNextPage } = buildDeferredClient();

      let address = "address-a";
      const { result, rerender } = setupQuery(() => useDeploymentsPage(address, { state: "active", skip: 0, limit: 10, countTotal: true }), {
        services: { chainApiHttpClient: () => chainApiHttpClient }
      });

      await vi.waitFor(() => expect(requestCount()).toBe(1));
      resolveNextPage([buildRpcDeployment({ deployment: { id: { owner: "address-a", dseq: "1" }, state: "active" } })], 5);
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
        resolveNextPage: (deployments: ReturnType<typeof buildRpcDeployment>[], total: number) => {
          const resolve = resolvers[resolvedCount++];
          if (!resolve) throw new Error("No pending deployments request to resolve");
          resolve({ data: { deployments, pagination: { next_key: null, total: String(total) } } });
        }
      };
    }

    function buildClient(input: { total: number; deployments?: ReturnType<typeof buildRpcDeployment>[] }) {
      return mock<FallbackableHttpClient>({
        get: vi.fn().mockResolvedValue({
          data: {
            deployments: input.deployments ?? [],
            pagination: { next_key: null, total: String(input.total) }
          }
        })
      } as unknown as FallbackableHttpClient);
    }

    function setup(input: { total: number; deployments?: ReturnType<typeof buildRpcDeployment>[]; countTotal?: boolean }) {
      const chainApiHttpClient = buildClient(input);
      const { result } = setupQuery(() => useDeploymentsPage("test-address", { state: "active", skip: 20, limit: 10, countTotal: input.countTotal ?? true }), {
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
