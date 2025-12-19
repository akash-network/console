process.env.AUTH0_SECRET ??= "test-secret";
process.env.AUTH0_CLIENT_ID ??= "test-client-id";
process.env.AUTH0_CLIENT_SECRET ??= "test-client-secret";

import { mock } from "jest-mock-extended";
import type { NextApiRequest, NextApiResponse } from "next";

import { getSession, Session } from "@src/lib/auth0";
import { setSession } from "./setSession";

describe(setSession.name, () => {
  it("can set session", async () => {
    const req = mock<NextApiRequest>();
    const res = mock<NextApiResponse>();
    const session = new Session({
      someClaim: "someValue"
    });
    await setSession(req, res, session);

    expect(await getSession(req, res)).toEqual(session);
  });
});
