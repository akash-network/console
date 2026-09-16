import type { NextApiRequest, NextApiResponse } from "next";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { services } from "@src/services/app-di-container/server-di-container.service";
import healthz from "./healthz";

describe(healthz.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("responds 200 with an ok status", async () => {
    const { res } = await setup({});

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: { status: "ok" } });
  });

  it("responds without waiting on the session lookup", async () => {
    const { res } = await setup({ getSession: () => new Promise<never>(() => {}) });

    expect(res.status).toHaveBeenCalledWith(200);
  });

  async function setup(input: { getSession?: typeof services.getSession }) {
    vi.spyOn(services, "getSession").mockImplementation(input.getSession ?? (async () => null));
    const req = new IncomingMessage(new Socket()) as NextApiRequest;
    req.headers = { "x-forwarded-host": "localhost", "x-forwarded-for": "127.0.0.1", "x-forwarded-proto": "http" };
    const res = mock<NextApiResponse>();
    res.status.mockReturnValue(res);

    await healthz(req, res);

    return { req, res };
  }
});
