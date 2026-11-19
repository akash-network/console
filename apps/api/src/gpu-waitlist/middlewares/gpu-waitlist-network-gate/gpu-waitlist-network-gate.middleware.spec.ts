import { Hono } from "hono";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { GpuWaitlistNetworkService } from "@src/gpu-waitlist/services/gpu-waitlist-network/gpu-waitlist-network.service";
import { hideUnlessGpuWaitlistsAreServed } from "./gpu-waitlist-network-gate.middleware";

const GUARDED_PATH = "/guarded";
const GUARDED_BODY = "reached the handler";
const NOT_FOUND_BODY = "nothing here";

describe(hideUnlessGpuWaitlistsAreServed.name, () => {
  afterEach(() => {
    container.clearInstances();
  });

  it("lets the request reach the handler on a network that serves gpu waitlists", async () => {
    const { request } = setup({ servesGpuWaitlists: true });

    const response = await request(GUARDED_PATH);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(GUARDED_BODY);
  });

  it("answers exactly like an unmatched path on a network that does not serve gpu waitlists", async () => {
    const { request } = setup({ servesGpuWaitlists: false });

    const gated = await request(GUARDED_PATH);
    const unmatched = await request("/unmatched");

    expect(gated.status).toBe(404);
    expect([gated.status, await gated.text()]).toEqual([unmatched.status, await unmatched.text()]);
  });

  function setup(input: { servesGpuWaitlists: boolean }) {
    const gpuWaitlistNetworkService = mock<GpuWaitlistNetworkService>();
    gpuWaitlistNetworkService.servesGpuWaitlists.mockReturnValue(input.servesGpuWaitlists);
    container.registerInstance(GpuWaitlistNetworkService, gpuWaitlistNetworkService);

    const app = new Hono();
    app.notFound(c => c.text(NOT_FOUND_BODY, 404));
    app.use(GUARDED_PATH, hideUnlessGpuWaitlistsAreServed);
    app.get(GUARDED_PATH, c => c.text(GUARDED_BODY));

    return { request: (path: string) => app.request(path) };
  }
});
