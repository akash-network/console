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

    it("keys the query by address, state, skip and limit", async () => {
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
      expect(query.queryKey).toEqual(QueryKeys.getDeploymentsPageKey("test-address", "closed", 30, 10));
    });

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
});
