import type { Context, Next } from "hono";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CoreConfig } from "@src/core/providers/config.provider";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { privateMiddleware, requirePrivateToken } from "./privateMiddleware";

describe("privateMiddleware", () => {
  it("lets the request through when the token matches", async () => {
    const { c, next } = setup({ secretToken: "secret", queryToken: "secret" });

    await privateMiddleware(c, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects a mismatched token", async () => {
    const { c, next } = setup({ secretToken: "secret", queryToken: "wrong" });

    await privateMiddleware(c, next);

    expect(next).not.toHaveBeenCalled();
    expect(c.text).toHaveBeenCalledWith("Unauthorized", 401);
  });

  it("lets the request through when no secret is configured", async () => {
    const { c, next } = setup({ secretToken: undefined, queryToken: undefined });

    await privateMiddleware(c, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("requirePrivateToken", () => {
  it("lets the request through when the token matches", async () => {
    const { c, next } = setup({ secretToken: "secret", queryToken: "secret" });

    await requirePrivateToken(c, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects a mismatched token", async () => {
    const { c, next } = setup({ secretToken: "secret", queryToken: "wrong" });

    await requirePrivateToken(c, next);

    expect(next).not.toHaveBeenCalled();
    expect(c.text).toHaveBeenCalledWith("Unauthorized", 401);
  });

  it("rejects the request when no secret is configured", async () => {
    const { c, next } = setup({ secretToken: undefined, queryToken: undefined });

    await requirePrivateToken(c, next);

    expect(next).not.toHaveBeenCalled();
    expect(c.text).toHaveBeenCalledWith("Unauthorized", 401);
  });
});

function setup(input: { secretToken?: string; queryToken?: string }) {
  container.registerInstance(CORE_CONFIG, mock<CoreConfig>({ SECRET_TOKEN: input.secretToken }));

  const c = mock<Context>({ req: mock<Context["req"]>({ query: vi.fn().mockReturnValue(input.queryToken) }) });
  const next = vi.fn<Next>();

  return { c, next };
}
