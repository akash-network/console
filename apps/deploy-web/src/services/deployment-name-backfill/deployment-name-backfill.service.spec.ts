import { describe, expect, it, vi } from "vitest";

import { DeploymentNameBackfillService } from "./deployment-name-backfill.service";

describe(DeploymentNameBackfillService.name, () => {
  it("backfills a deployment as soon as it is enqueued", async () => {
    const { service, backfill } = setup();
    const only = backfill();

    service.enqueue("100", only.run);

    await vi.waitFor(() => expect(only.run).toHaveBeenCalled());
  });

  it("starts a backfill only once the one before it settled", async () => {
    const { service, backfill } = setup();
    const first = backfill();
    const second = backfill();

    service.enqueue("100", first.run);
    service.enqueue("200", second.run);

    await vi.waitFor(() => expect(first.run).toHaveBeenCalled());
    expect(second.run).not.toHaveBeenCalled();

    first.finish();

    await vi.waitFor(() => expect(second.run).toHaveBeenCalled());
  });

  it("backfills a deployment once when two surfaces ask for it at the same time", () => {
    const { service, backfill } = setup();
    const first = backfill();
    const repeat = backfill();

    service.enqueue("100", first.run);
    service.enqueue("100", repeat.run);

    expect(repeat.run).not.toHaveBeenCalled();
  });

  it("leaves a deployment alone once its backfill settled", async () => {
    const { service, backfill, flush } = setup();
    const first = backfill();
    const repeat = backfill();

    service.enqueue("100", first.run);
    first.finish();
    await flush();
    service.enqueue("100", repeat.run);

    expect(repeat.run).not.toHaveBeenCalled();
  });

  it("goes on to the next deployment after a backfill failed", async () => {
    const { service, backfill } = setup();
    const failing = backfill();
    const next = backfill();

    service.enqueue("100", failing.run);
    service.enqueue("200", next.run);
    failing.fail();

    await vi.waitFor(() => expect(next.run).toHaveBeenCalled());
  });

  it("leaves a deployment alone after its backfill failed", async () => {
    const { service, backfill, flush } = setup();
    const failing = backfill();
    const retry = backfill();

    service.enqueue("100", failing.run);
    failing.fail();
    await flush();
    service.enqueue("100", retry.run);

    expect(retry.run).not.toHaveBeenCalled();
  });

  it("drops a queued backfill for the deployment being renamed", async () => {
    const { service, backfill, flush } = setup();
    const inFlight = backfill();
    const queued = backfill();

    service.enqueue("100", inFlight.run);
    service.enqueue("200", queued.run);
    await service.preempt("200");
    inFlight.finish();
    await flush();

    expect(queued.run).not.toHaveBeenCalled();
  });

  it("holds a rename until the backfill already writing that deployment's name settled", async () => {
    const { service, backfill, flush } = setup();
    const inFlight = backfill();
    service.enqueue("100", inFlight.run);
    const preempted = vi.fn();

    const waiting = service.preempt("100").then(preempted);
    await flush();
    expect(preempted).not.toHaveBeenCalled();

    inFlight.finish();
    await waiting;

    expect(preempted).toHaveBeenCalled();
  });

  it("releases a rename whose backfill failed, so it is not held on a write that will never land", async () => {
    const { service, backfill } = setup();
    const failing = backfill();
    service.enqueue("100", failing.run);

    const preempted = service.preempt("100");
    failing.fail();

    await expect(preempted).resolves.toBeUndefined();
  });

  it("renames a deployment no backfill is writing without waiting on an unrelated one", async () => {
    const { service, backfill } = setup();
    const unrelated = backfill();
    service.enqueue("100", unrelated.run);

    await expect(service.preempt("200")).resolves.toBeUndefined();
  });

  it("leaves a renamed deployment alone when a later answer asks for its backfill", async () => {
    const { service, backfill } = setup();
    const late = backfill();

    await service.preempt("100");
    service.enqueue("100", late.run);

    expect(late.run).not.toHaveBeenCalled();
  });

  function setup() {
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    function backfill() {
      let settle: () => void;
      let refuse: (error: Error) => void;
      const run = vi.fn(
        () =>
          new Promise<void>((resolve, reject) => {
            settle = resolve;
            refuse = reject;
          })
      );

      return {
        run,
        finish: () => settle(),
        fail: () => refuse(new Error("the api refused the backfill"))
      };
    }

    return { service: new DeploymentNameBackfillService(), backfill, flush };
  }
});
