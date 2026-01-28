import { createRoute } from "./create-route";

describe(createRoute.name, () => {
  it("returns a route config with path", () => {
    const route = createRoute({
      method: "get",
      path: "/test",
      responses: {
        200: {
          description: "ok"
        }
      }
    });

    expect(route.path).toBe("/test");
  });
});
