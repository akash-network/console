process.env.AUTH0_SECRET ??= "test-secret";
process.env.AUTH0_CLIENT_ID ??= "test-client-id";
process.env.AUTH0_CLIENT_SECRET ??= "test-client-secret";

import { Session } from "@auth0/nextjs-auth0";
// @ts-expect-error - access to internal function via Jest moduleNameMapper
import * as sessionModule from "@auth0/nextjs-auth0/session";
import { mock } from "jest-mock-extended";
import type { NextApiRequest, NextApiResponse } from "next";

import { setSession } from "./setSession";

// Note: jest.mock is required here because setSession is a standalone function
// with hardcoded module imports, not a class with injectable dependencies.
jest.mock("@auth0/nextjs-auth0/session", () => {
  const actual = jest.requireActual("@auth0/nextjs-auth0/session");
  return {
    ...actual,
    set: jest.fn()
  };
});

describe(setSession.name, () => {
  it("calls sessionModule.set with correct parameters", async () => {
    const { req, res, session } = setup();

    await setSession(req, res, session);

    expect(sessionModule.set).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        res,
        session,
        sessionCache: expect.anything()
      })
    );
  });

  function setup() {
    jest.clearAllMocks();

    const req = mock<NextApiRequest>();
    const res = mock<NextApiResponse>();
    const session = new Session({
      someClaim: "someValue"
    });

    return { req, res, session };
  }
});
