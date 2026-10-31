import { Hono } from "hono";
import { isHttpError } from "http-errors";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthService } from "@src/auth/services/auth.service";
import { requireAuthentication } from "./require-authentication.middleware";

import { createUser } from "@test/seeders/user.seeder";

const GUARDED_PATH = "/guarded";
const GUARDED_BODY = "reached the handler";

describe(requireAuthentication.name, () => {
  afterEach(() => {
    container.clearInstances();
  });

  it("lets a signed-in caller through to the rest of the route", async () => {
    const { request } = setup({ signedIn: true });

    const response = await request();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(GUARDED_BODY);
  });

  it("answers 401 without running the rest of the route when the caller is not signed in", async () => {
    const { request } = setup({ signedIn: false });

    const response = await request();

    expect(response.status).toBe(401);
    expect(await response.text()).not.toBe(GUARDED_BODY);
  });

  function setup(input: { signedIn: boolean }) {
    container.registerInstance(AuthService, mock<AuthService>({ safeCurrentUser: input.signedIn ? createUser() : undefined }));

    const app = new Hono();
    app.onError(error => new Response(error.message, { status: isHttpError(error) ? error.status : 500 }));
    app.use(GUARDED_PATH, requireAuthentication);
    app.get(GUARDED_PATH, c => c.text(GUARDED_BODY));

    return { request: () => app.request(GUARDED_PATH) };
  }
});
