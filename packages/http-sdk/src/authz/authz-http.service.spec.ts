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
