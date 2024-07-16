import { container } from "tsyringe";

import { app } from "@src/app";
import { ApiPgDatabase, POSTGRES_DB } from "@src/core";
import { USER_SCHEMA, UserSchema } from "@src/user/providers";
import { AnonymousUserOutput } from "@src/user/routes/schemas/user.schema";

describe("Users", () => {
  const schema = container.resolve<UserSchema>(USER_SCHEMA);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  let user: AnonymousUserOutput;

  beforeEach(async () => {
    const userResponse = await app.request("/v1/anonymous-users", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" })
    });
    user = await userResponse.json();
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
        headers: new Headers({ "Content-Type": "application/json" })
      });
      const retrievedUser = await getUserResponse.json();

      expect(retrievedUser).toMatchObject(user);
    });
  });
});
