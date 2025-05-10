import { app } from "@src/app";
import type { AuditorListResponse } from "@src/provider/http-schemas/auditor.schema";

describe("Auditors", () => {
  describe("GET /v1/auditors", () => {
    it("returns auditors", async () => {
      const response = await app.request("/v1/auditors");

      const data: AuditorListResponse = await response.json();

      expect(response.status).toBe(200);

      expect(data).toEqual(expect.arrayContaining([expect.any(Object)]));
      data.forEach(auditor => {
        expect(Object.keys(auditor).sort()).toEqual(["address", "id", "name", "website"]);
      });
    });
  });
});
