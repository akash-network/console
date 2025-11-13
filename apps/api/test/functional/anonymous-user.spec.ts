import { app } from "@src/rest-app";
import type { AnonymousUserResponseOutput } from "@src/user/schemas/user.schema";

describe("Users", () => {
  let user: AnonymousUserResponseOutput["data"];
  let token: AnonymousUserResponseOutput["token"];

  beforeEach(async () => {
    const userResponse = await app.request("/v1/anonymous-users", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" })
    });
    const body = (await userResponse.json()) as any;
    user = body.data;
    token = body.token;
  });

  describe("POST /v1/anonymous-users", () => {
    it("should create a user", async () => {
      expect(user).toMatchObject({ id: expect.any(String) });
    });
  });

  describe("GET /v1/anonymous-users", () => {
    it("should retrieve a user", async () => {
      const getUserResponse = await app.request(`/v1/anonymous-users/${user.id}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` })
      });
      const retrievedUser = await getUserResponse.json();

      expect(retrievedUser).toMatchObject({
        data: {
          ...user,
          lastActiveAt: expect.any(String)
        }
      });
    });

    it("should throw 401 provided no auth header", async () => {
      const res = await app.request(`/v1/anonymous-users/${user.id}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: "UnauthorizedError", message: "Unauthorized" });
    });

    it("should throw 404 provided a different user auth header", async () => {
      const differentUserResponse = await app.request("/v1/anonymous-users", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const { token: differentUserToken } = (await differentUserResponse.json()) as any;
      const res = await app.request(`/v1/anonymous-users/${user.id}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${differentUserToken}` })
      });

      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: "NotFoundError", message: "Not Found" });
    });

    it("should throw 400 for invalid UUID format", async () => {
      const res = await app.request(`/v1/anonymous-users/invalid-uuid`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` })
      });

      expect(res.status).toBe(400);
    });

    it("should throw 400 for UUID with leading colon", async () => {
      const res = await app.request(`/v1/anonymous-users/:b8a0e9f1-b0d8-41d0-8416-7ab25f81b6c5`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${token}` })
      });

      expect(res.status).toBe(400);
    });
  });
});
