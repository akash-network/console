import type { AuditorListResponse } from "@src/provider/http-schemas/auditor.schema";
import { app } from "@src/rest-app";

describe("Auditors", () => {
  describe("GET /v1/auditors", () => {
    it("returns auditors", async () => {
      const response = await app.request("/v1/auditors");

      const data = (await response.json()) as AuditorListResponse;

      expect(response.status).toBe(200);

      expect(data).toEqual(expect.arrayContaining([expect.any(Object)]));
      data.forEach(auditor => {
        expect(Object.keys(auditor).sort()).toEqual(["address", "id", "name", "website"]);
      });
    });
  });
});
