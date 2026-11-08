import { describe, expect, it, onTestFinished, vi } from "vitest";

import { NodeInfo, NodeStatus } from "./nodeInfo";

const UNREADABLE_HEIGHTS = ["not-a-number", "", null, undefined, "0", "-5", "1e3", "99999999999999999999", 1.5];

describe(NodeInfo.name, () => {
  describe("updateStatus", () => {
    it("marks the node available when it reports a valid latest block height", async () => {
      const { node } = setup({ statusResponses: [statusReporting("1000")] });

      await node.updateStatus();

      expect(node.status).toBe(NodeStatus.OK);
      expect(node.earliestBlockHeight).toBe(1);
    });

    it.each(UNREADABLE_HEIGHTS)("marks the node unavailable when it reports %j as its latest block height", async reportedHeight => {
      const { node } = setup({ statusResponses: [statusReporting(reportedHeight)] });

      await node.updateStatus();

      expect(node.status).toBe(NodeStatus.UNAVAILABLE);
      expect(node.latestError).toBe("Invalid latest block height");
    });
  });

  describe("queryLatestBlockHeight", () => {
    it("returns the latest block height the node reports as a string", async () => {
      const { node } = setup({ statusResponses: [statusReporting("1000")] });

      await expect(node.queryLatestBlockHeight()).resolves.toBe(1000);
    });

    it("returns the latest block height the node reports as a number", async () => {
      const { node } = setup({ statusResponses: [statusReporting(1000)] });

      await expect(node.queryLatestBlockHeight()).resolves.toBe(1000);
    });

    it.each(UNREADABLE_HEIGHTS)("rejects %j as a latest block height and marks the node unavailable", async reportedHeight => {
      const { node } = setup({ statusResponses: [statusReporting(reportedHeight)] });

      await expect(node.queryLatestBlockHeight()).rejects.toThrow("Invalid latest block height");
      expect(node.status).toBe(NodeStatus.UNAVAILABLE);
      expect(node.latestError).toBe("Invalid latest block height");
      expect(node.errorCount).toBe(1);
    });

    it.each([null, {}, { result: {} }])("rejects a status of %j and marks the node unavailable", async status => {
      const { node } = setup({ statusResponses: [status] });

      await expect(node.queryLatestBlockHeight()).rejects.toThrow("Invalid latest block height");
      expect(node.status).toBe(NodeStatus.UNAVAILABLE);
    });

    it("checks the node again later and restores it once it reports a valid height", async () => {
      const { node } = setup({ statusResponses: [statusReporting("not-a-number"), statusReporting("1000")] });

      await expect(node.queryLatestBlockHeight()).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(5 * 60_000);

      expect(node.status).toBe(NodeStatus.OK);
    });
  });

  function setup(input: { statusResponses: unknown[] }) {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const fetch = vi.spyOn(globalThis, "fetch");
    for (const body of input.statusResponses) {
      fetch.mockResolvedValueOnce(Response.json(body));
    }
    onTestFinished(() => {
      fetch.mockRestore();
      vi.useRealTimers();
    });

    return { node: new NodeInfo("http://rpc.example.com", 5) };
  }

  function statusReporting(latestBlockHeight: unknown) {
    return { result: { sync_info: { earliest_block_height: "1", latest_block_height: latestBlockHeight } } };
  }
});
