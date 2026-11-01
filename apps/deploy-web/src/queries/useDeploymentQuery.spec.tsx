import { createProxy } from "@akashnetwork/react-query-proxy";
import { describe, expect, it, vi } from "vitest";

import { deploymentToDto } from "@src/utils/deploymentDetailUtils";
import { QueryKeys } from "./queryKeys";
import { useDeploymentDetail } from "./useDeploymentQuery";

import { buildRpcDeployment } from "@tests/seeders/deployment";
import { type RenderAppHookOptions, setupQuery } from "@tests/unit/query-client";

type ApiService = ReturnType<NonNullable<NonNullable<RenderAppHookOptions["services"]>["api"]>>;

describe("useDeploymentQuery", () => {
  describe(useDeploymentDetail.name, () => {
    it("reads the deployment from the API and maps it like a chain deployment", async () => {
      const deployment = buildRpcDeployment({ deployment: { id: { dseq: "1234" } } });
      const { result, getDeploymentInfo } = setup({ deployment });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(getDeploymentInfo).toHaveBeenCalledWith({ dseq: "1234" });
      expect(result.current.data).toEqual(deploymentToDto(deployment));
    });

    it("answers no deployment without a wallet address", async () => {
      const { result, getDeploymentInfo } = setup({ address: "" });

      await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeNull();
      expect(getDeploymentInfo).not.toHaveBeenCalled();
    });
  });

  describe(QueryKeys.getDeploymentListKey.name, () => {
    it("keeps the address segment even when the address is empty and state is omitted", () => {
      expect(QueryKeys.getDeploymentListKey("", "active")).toEqual(["DEPLOYMENT_LIST", "", "active"]);
      expect(QueryKeys.getDeploymentListKey("akash1abc")).toEqual(["DEPLOYMENT_LIST", "akash1abc"]);
    });
  });

  function setup(input: { address?: string; deployment?: ReturnType<typeof buildRpcDeployment> }) {
    const getDeploymentInfo = vi.fn().mockResolvedValue({ data: input.deployment ?? buildRpcDeployment() });
    const api = createProxy({ v1: { getDeploymentInfo } }) as unknown as ApiService;

    const { result } = setupQuery(() => useDeploymentDetail(input.address ?? "akash1owner", "1234"), {
      services: { api: () => api }
    });

    return { result, getDeploymentInfo };
  }
});
