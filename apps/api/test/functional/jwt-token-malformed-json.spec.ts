import { app } from "@src/rest-app";

jest.setTimeout(30000);

describe("JWT Token Endpoint - Malformed JSON Handling", () => {
  describe("POST /v1/create-jwt-token", () => {
    it("should return 400 status code for malformed JSON", async () => {
      const response = await app.request("/v1/create-jwt-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: "{ invalid json }"
      });

      expect(response.status).toBe(400);
      
      const responseData = await response.json();
      expect(responseData).toHaveProperty("error");
      expect(responseData).toHaveProperty("message");
      expect(responseData.message).toMatch(/malformed json/i);
    });

    it("should return 400 status code for completely invalid JSON", async () => {
      const response = await app.request("/v1/create-jwt-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: "not json at all"
      });

      expect(response.status).toBe(400);
      
      const responseData = await response.json();
      expect(responseData).toHaveProperty("error");
      expect(responseData).toHaveProperty("message");
      expect(responseData.message).toMatch(/malformed json/i);
    });

    it("should return 400 status code for truncated JSON", async () => {
      const response = await app.request("/v1/create-jwt-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: '{"data": {"provider'
      });

      expect(response.status).toBe(400);
      
      const responseData = await response.json();
      expect(responseData).toHaveProperty("error");
      expect(responseData).toHaveProperty("message");
      expect(responseData.message).toMatch(/malformed json/i);
    });
  });
});
