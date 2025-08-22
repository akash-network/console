import { app } from "@src/rest-app";

describe("API Docs", () => {
  describe("GET /v1/doc", () => {
    it(`returns docs with all routes expected`, async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-07-03T12:00:00.000Z"));

      const response = await app.request(`/v1/doc`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toMatchSnapshot();

      jest.useRealTimers();
    });
  });
});
