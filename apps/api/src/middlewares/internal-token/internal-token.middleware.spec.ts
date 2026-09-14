import type { Context, Next } from "hono";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CoreConfig } from "@src/core/providers/config.provider";
import { CORE_CONFIG } from "@src/core/providers/config.provider";
import { INTERNAL_TOKEN_HEADER, requireInternalToken } from "./internal-token.middleware";

describe("requireInternalToken", () => {
  it("lets the request through when the header matches the configured token", async () => {
    const { c, next } = setup({ configuredToken: "secret", providedToken: "secret" });

    await requireInternalToken(c, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("reads the token from a header rather than the query string", async () => {
    const { c, header } = setup({ configuredToken: "secret", providedToken: "secret" });

    await requireInternalToken(c, vi.fn<Next>());

    expect(header).toHaveBeenCalledWith(INTERNAL_TOKEN_HEADER);
  });

  it.each([
    { label: "a mismatched token", input: { configuredToken: "secret", providedToken: "wrong" } },
    { label: "a token of a different length", input: { configuredToken: "secret", providedToken: "a-much-longer-wrong-token" } },
    { label: "a missing header", input: { configuredToken: "secret", providedToken: undefined } },
    { label: "an empty header", input: { configuredToken: "secret", providedToken: "" } },
    { label: "an unconfigured token", input: { configuredToken: undefined, providedToken: "secret" } },
    { label: "neither side configured", input: { configuredToken: undefined, providedToken: undefined } }
  ])("rejects $label", async ({ input }) => {
    const { c, next, text } = setup(input);

    await requireInternalToken(c, next);

    expect(next).not.toHaveBeenCalled();
    expect(text).toHaveBeenCalledWith("Unauthorized", 401);
  });
});

function setup(input: { configuredToken?: string; providedToken?: string }) {
  container.registerInstance(CORE_CONFIG, mock<CoreConfig>({ INTERNAL_API_TOKEN: input.configuredToken }));

  const text = vi.fn();
  const header = vi.fn().mockReturnValue(input.providedToken);
  const c = { req: { header }, text } as unknown as Context;
  const next = vi.fn<Next>();

  return { c, next, text, header };
}
