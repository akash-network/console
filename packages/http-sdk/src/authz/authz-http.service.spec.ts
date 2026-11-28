import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { HttpClient } from "../utils/httpClient";
import { AuthzHttpService } from "./authz-http.service";

describe(AuthzHttpService.name, () => {
  describe("getValidDepositDeploymentGrantsForGranterAndGrantee", () => {
    it("asks for the grant at the latest height when no height is given", async () => {
      const { service, httpClient } = setup();

      await service.getValidDepositDeploymentGrantsForGranterAndGrantee("akash1granter", "akash1grantee");

      expect(httpClient.get).toHaveBeenCalledWith("cosmos/authz/v1beta1/grants", { params: { grantee: "akash1grantee", granter: "akash1granter" } });
    });

    it("pins the query to the given height", async () => {
      const { service, httpClient } = setup();

      await service.getValidDepositDeploymentGrantsForGranterAndGrantee("akash1granter", "akash1grantee", { height: 1234 });

      expect(httpClient.get).toHaveBeenCalledWith("cosmos/authz/v1beta1/grants", {
        params: { grantee: "akash1grantee", granter: "akash1granter" },
        headers: { "x-cosmos-block-height": "1234" }
      });
    });

    it("returns the unexpired deposit grant with its spend limits", async () => {
      const { service, grant } = setup();

      expect(await service.getValidDepositDeploymentGrantsForGranterAndGrantee("akash1granter", "akash1grantee", { height: 1234 })).toEqual(grant);
    });
  });

  describe("getPaginatedDepositDeploymentGrants", () => {
    it("asks for a page at the latest height when no height is given", async () => {
      const { service, httpClient } = setup();

      await service.getPaginatedDepositDeploymentGrants({ granter: "akash1granter", limit: 500, offset: 1000 });

      expect(httpClient.get).toHaveBeenCalledWith("cosmos/authz/v1beta1/grants/granter/akash1granter", {
        params: { "pagination.limit": 500, "pagination.offset": 1000, "pagination.count_total": true }
      });
    });

    it("pins a page to the given height, so every page of one listing reads the same block", async () => {
      const { service, httpClient } = setup();

      await service.getPaginatedDepositDeploymentGrants({ granter: "akash1granter", limit: 500, offset: 0, height: 1234 });

      expect(httpClient.get).toHaveBeenCalledWith("cosmos/authz/v1beta1/grants/granter/akash1granter", {
        params: { "pagination.limit": 500, "pagination.offset": 0, "pagination.count_total": true },
        headers: { "x-cosmos-block-height": "1234" }
      });
    });

    it("returns the grants of the page with the total the chain counts", async () => {
      const { service, httpClient, grant } = setup();
      httpClient.get.mockResolvedValue({ data: { grants: [grant], pagination: { next_key: null, total: "4211" } } });

      await expect(service.getPaginatedDepositDeploymentGrants({ granter: "akash1granter", limit: 500, offset: 0, height: 1234 })).resolves.toMatchObject({
        grants: [{ authorization: grant.authorization }],
        pagination: { next_key: null, total: 4211 }
      });
    });
  });

  function setup() {
    const grant = {
      authorization: { "@type": "/akash.escrow.v1.DepositAuthorization" as const, spend_limits: [{ denom: "uact", amount: "500" }] },
      expiration: addDays(new Date(), 30).toISOString()
    };
    const httpClient = mock<HttpClient>();
    httpClient.get.mockResolvedValue({ data: { grants: [grant] } });

    return { service: new AuthzHttpService(httpClient), httpClient, grant };
  }
});
