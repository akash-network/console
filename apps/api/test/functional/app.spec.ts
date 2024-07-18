import { app, initDb } from "@src/app";
import { closeConnections } from "@src/db/dbConnection";

describe("app", () => {
  beforeAll(async () => {
    await initDb();
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
          external: expect.stringMatching(/^[0-9.]+ (M|G)B$/),
          heapTotal: expect.stringMatching(/^[0-9.]+ (M|G)B$/),
          heapUsed: expect.stringMatching(/^[0-9.]+ (M|G)B$/),
          rss: expect.stringMatching(/^[0-9.]+ (M|G)B$/)
        },
        tasks: [],
        version: expect.stringMatching(/^[0-9]+.[0-9]+.[0-9]+$/)
      });
    });
  });
});
