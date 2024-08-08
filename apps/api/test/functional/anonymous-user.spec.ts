import { container } from "tsyringe";

import { app } from "@src/app";
import { ApiPgDatabase, POSTGRES_DB } from "@src/core";
import { USER_SCHEMA, UserSchema } from "@src/user/providers";
import { AnonymousUserResponseOutput } from "@src/user/schemas/user.schema";

describe("Users", () => {
  const schema = container.resolve<UserSchema>(USER_SCHEMA);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  let user: AnonymousUserResponseOutput["data"];
  let token: AnonymousUserResponseOutput["token"];

  beforeEach(async () => {
    const userResponse = await app.request("/v1/anonymous-users", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" })
    });
    const body = await userResponse.json();
    user = body.data;
    token = body.token;
  });

  afterEach(async () => {
    await db.delete(schema);
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

      expect(retrievedUser).toMatchObject({ data: user });
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
      const { token: differentUserToken } = await differentUserResponse.json();
      const res = await app.request(`/v1/anonymous-users/${user.id}`, {
        method: "GET",
        headers: new Headers({ "Content-Type": "application/json", authorization: `Bearer ${differentUserToken}` })
      });

      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: "NotFoundError", message: "Not Found" });
    });
  });
});
