import { Hono } from "hono";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { requireFeatureFlag } from "./feature-flag-gate.middleware";

const GUARDED_PATH = "/guarded";
const GUARDED_BODY = "reached the handler";
const NOT_FOUND_BODY = "nothing here";

describe(requireFeatureFlag.name, () => {
  afterEach(() => {
    container.clearInstances();
  });

  it("lets the request reach the handler when the flag is on for the caller", async () => {
    const { request } = setup({ flagOn: true });

    const response = await request(GUARDED_PATH);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(GUARDED_BODY);
  });

  it("answers with the app's own not-found handler when the flag is off for the caller", async () => {
    const { request } = setup({ flagOn: false });

    const response = await request(GUARDED_PATH);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe(NOT_FOUND_BODY);
  });

  it("answers exactly like an unmatched path when the flag is off for the caller", async () => {
    const { request } = setup({ flagOn: false });

    const gated = await request(GUARDED_PATH);
    const unmatched = await request("/unmatched");

    expect([gated.status, await gated.text()]).toEqual([unmatched.status, await unmatched.text()]);
  });

  it("evaluates the flag it guards", async () => {
    const { request, featureFlagsService } = setup({ flagOn: true });

    await request(GUARDED_PATH);

    expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.ORGANIZATIONS);
  });

  function setup(input: { flagOn: boolean }) {
    const featureFlagsService = mock<FeatureFlagsService>();
    featureFlagsService.isEnabled.mockReturnValue(input.flagOn);
    container.registerInstance(FeatureFlagsService, featureFlagsService);

    const app = new Hono();
    app.notFound(c => c.text(NOT_FOUND_BODY, 404));
    app.use(GUARDED_PATH, requireFeatureFlag(FeatureFlags.ORGANIZATIONS));
    app.get(GUARDED_PATH, c => c.text(GUARDED_BODY));

    return { featureFlagsService, request: (path: string) => app.request(path) };
  }
});
