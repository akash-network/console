import { describe, expect, it, onTestFinished, vi } from "vitest";

import { findLatestBlockHeight } from "./nodeAccessor";
import { NodeInfo, NodeStatus } from "./nodeInfo";

describe(findLatestBlockHeight.name, () => {
  it("returns the highest latest block height the nodes report", async () => {
    const { nodes } = setup({ nodes: [{ reportedHeight: "1000" }, { reportedHeight: "1002" }, { reportedHeight: "998" }] });

    await expect(findLatestBlockHeight(nodes)).resolves.toBe(1002);
  });

  it.each(["not-a-number", "", null, undefined])("ignores a node that reports %j and marks it unavailable", async reportedHeight => {
    const { nodes } = setup({ nodes: [{ reportedHeight: "1000" }, { reportedHeight: "999" }, { reportedHeight }] });

    await expect(findLatestBlockHeight(nodes)).resolves.toBe(1000);
    expect(nodes.map(node => node.status)).toEqual([NodeStatus.OK, NodeStatus.OK, NodeStatus.UNAVAILABLE]);
  });

  it("leaves out nodes that are not available", async () => {
    const { nodes, fetch } = setup({ nodes: [{ reportedHeight: "1000" }, { reportedHeight: "2000", status: NodeStatus.UNAVAILABLE }] });

    await expect(findLatestBlockHeight(nodes)).resolves.toBe(1000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fails with a clear error when no node reports a valid latest block height", async () => {
    const { nodes } = setup({ nodes: [{ reportedHeight: "not-a-number" }, { reportedHeight: "" }] });

    await expect(findLatestBlockHeight(nodes)).rejects.toThrow("No active node reported a valid latest block height");
  });

  function setup(input: { nodes: { reportedHeight: unknown; status?: NodeStatus }[] }) {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const nodes = input.nodes.map(({ status = NodeStatus.OK }, index) => {
      const node = new NodeInfo(`http://rpc-${index}.example.com`, 5);
      node.loadFromSavedNodeInfo({ url: node.url, status, earliestBlockHeight: 1, maxConcurrentQuery: 5, delayBetweenRequests: 0 });
      return node;
    });
    const reportedHeightByStatusUrl = new Map(nodes.map((node, index) => [`${node.url}/status`, input.nodes[index].reportedHeight]));
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async url =>
        Response.json({ result: { sync_info: { earliest_block_height: "1", latest_block_height: reportedHeightByStatusUrl.get(String(url)) } } })
      );
    onTestFinished(() => {
      fetch.mockRestore();
      vi.useRealTimers();
    });

    return { nodes, fetch };
  }
});
