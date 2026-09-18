import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FallbackableHttpClient } from "@src/services/createFallbackableHttpClient/createFallbackableHttpClient";
import { setupQuery } from "../../tests/unit/query-client";
import { QueryKeys } from "./queryKeys";
import { useDeploymentList } from "./useDeploymentQuery";

describe("useDeploymentQuery", () => {
  describe(useDeploymentList.name, () => {
    it("requests the full state list newest-first so search matches browse order", async () => {
      const chainApiHttpClient = mock<FallbackableHttpClient>();
      chainApiHttpClient.get.mockResolvedValue({
        data: { deployments: [], pagination: { next_key: null, total: "0" } }
      });

      const { result } = setupQuery(() => useDeploymentList("test-address", undefined, "active"), {
        services: { chainApiHttpClient: () => chainApiHttpClient }
      });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(chainApiHttpClient.get.mock.calls[0][0]).toContain("pagination.reverse=true");
    });
  });

  describe(QueryKeys.getDeploymentListKey.name, () => {
    it("keeps the address segment even when the address is empty and state is omitted", () => {
      expect(QueryKeys.getDeploymentListKey("", "active")).toEqual(["DEPLOYMENT_LIST", "", "active"]);
      expect(QueryKeys.getDeploymentListKey("akash1abc")).toEqual(["DEPLOYMENT_LIST", "akash1abc"]);
    });
  });
});
