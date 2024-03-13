import { app, initDb } from "@src/app";
import { closeConnections } from "@src/db/dbConnection";

describe("app", () => {
  beforeAll(async () => {
    await initDb({ log: false });
  });

  afterAll(async () => {
    await closeConnections();
  });

  describe("GET /status", () => {
    it("should return app stats and meta", async () => {
      const res = await app.request("/status");
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        memory: {
          external: expect.stringMatching(/^[0-9.]+ MB$/),
          heapTotal: expect.stringMatching(/^[0-9.]+ MB$/),
          heapUsed: expect.stringMatching(/^[0-9.]+ MB$/),
          rss: expect.stringMatching(/^[0-9.]+ MB$/)
        },
        tasks: [],
        version: expect.stringMatching(/^[0-9]+.[0-9]+.[0-9]+$/)
      });
    });
  });
});
