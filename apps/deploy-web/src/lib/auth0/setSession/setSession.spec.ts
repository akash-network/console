process.env.AUTH0_SECRET ??= "test-secret";
process.env.AUTH0_CLIENT_ID ??= "test-client-id";
process.env.AUTH0_CLIENT_SECRET ??= "test-client-secret";

import { Session } from "@auth0/nextjs-auth0";
import { mock } from "jest-mock-extended";
import type { NextApiRequest, NextApiResponse } from "next";

import { setSession } from "./setSession";

describe(setSession.name, () => {
  it("calls sessionModule.set with correct parameters", async () => {
    const { req, res, session, mockSessionModule } = setup();

    await setSession(req, res, session, mockSessionModule);

    expect(mockSessionModule.set).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        res,
        session,
        sessionCache: expect.anything()
      })
    );
  });

  function setup() {
    const req = mock<NextApiRequest>();
    const res = mock<NextApiResponse>();
    const session = new Session({
      someClaim: "someValue"
    });
    const mockSessionModule = {
      set: jest.fn()
    };

    return { req, res, session, mockSessionModule };
  }
});
