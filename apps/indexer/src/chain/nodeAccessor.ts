import { activeChain } from "@akashnetwork/cloudmos-shared/chainDefinitions";
import fs from "fs";

import { concurrentNodeQuery, dataFolderPath } from "@src/shared/constants";
import { sleep } from "@src/shared/utils/delay";
import { NodeInfo, NodeStatus, SavedNodeInfo } from "./nodeInfo";

interface NodeAccessorSettings {
  maxConcurrentQueryPerNode: number;
}

const savedNodeInfoPath = dataFolderPath + "/nodeStatus.json";

class NodeAccessor {
  private nodes: NodeInfo[];
  private settings: NodeAccessorSettings;

  constructor(settings: NodeAccessorSettings) {
    this.settings = settings;
    this.nodes = activeChain.rpcNodes.map(x => new NodeInfo(x, settings.maxConcurrentQueryPerNode));
  }

  private async saveNodeStatus() {
    console.log("Saving node status...");
    const statuses = this.nodes.map(x => x.getSavedNodeInfo());

    await fs.promises.writeFile(savedNodeInfoPath, JSON.stringify(statuses, null, 2));
  }

  private async refetchNodeStatus() {
    const promises = this.nodes.map(x => x.updateStatus());

    await Promise.allSettled(promises);
  }

  public async loadNodeStatus() {
    if (!fs.existsSync(savedNodeInfoPath)) {
      console.log("No saved node status found");
      await this.refetchNodeStatus();
      await this.saveNodeStatus();
      return;
    }

    console.log("Loading saved node status...");
    const file = await fs.promises.readFile(savedNodeInfoPath, "utf-8");
    const savedNodes = JSON.parse(file) as SavedNodeInfo[];

    for (const savedNode of savedNodes) {
      const node = this.nodes.find(x => x.url === savedNode.url);

      if (node) {
        node.loadFromSavedNodeInfo(savedNode);
      }
    }

    setInterval(() => this.saveNodeStatus(), 30_000);
  }

  public async getBlock(height: number) {
    return await this.fetch(`/block?height=${height}`, height);
  }

  public async getBlockResult(height: number) {
    return await this.fetch(`/block_results?height=${height}`, height);
  }

  public async getLatestBlockHeight(): Promise<number> {
    const results = await Promise.allSettled(
      this.nodes
        .filter(node => node.status === NodeStatus.OK)
        .map(async node => {
          const response = await node.query("/status");
          return parseInt(response.result.sync_info.latest_block_height);
        })
    );

    const validResults = results.filter(result => result.status === "fulfilled").map(result => (result as PromiseFulfilledResult<number>).value);

    if (validResults.length === 0) {
      throw new Error("No active nodes");
    }

    const latestAvailableHeight = Math.max(...validResults);

    if (typeof latestAvailableHeight !== "number") {
      throw new Error("Invalid latest block height");
    }

    return latestAvailableHeight;
  }

  public async waitForAvailableNode(height?: number): Promise<void> {
    while (!this.isNodeAvailable(height)) {
      await sleep(5);
    }
  }

  public async waitForAllFinished(): Promise<void> {
    while (this.nodes.some(x => x.activeQueries.length > 0)) {
      await sleep(5);
    }
  }

  public isNodeAvailable(height?: number) {
    return !!this.getAvailableNode(height);
  }

  private async fetch(path: string, height?: number): Promise<any> {
    let node = this.getAvailableNode(height);

    if (!node) await this.waitForAvailableNode(height);
    node = this.getAvailableNode(height);

    try {
      return await node.query(path, height);
    } catch (err) {
      err.message = "[NodeAccessError] " + err.message;
      throw err;
    }
  }

  private getAvailableNode(height?: number): NodeInfo {
    const availableNodes = this.nodes.filter(x => x.isAvailable(height));

    if (availableNodes.length === 0) return null;

    const minActiveQueries = Math.min(...availableNodes.map(a => a.activeQueries.length));
    const bestNodes = availableNodes.filter(x => x.activeQueries.length === minActiveQueries);

    return bestNodes[Math.floor(Math.random() * bestNodes.length)];
  }

  public getActiveNodeCount() {
    return this.nodes.filter(x => x.status === NodeStatus.OK).length;
  }

  public getNodeStatus() {
    return this.nodes
      .sort((a, b) => a.url.localeCompare(b.url))
      .map(x => ({
        endpoint: x.url,
        status: x.status,
        concurrent: x.maxConcurrentQuery,
        delay: x.delayBetweenRequests,
        earliest: x.earliestBlockHeight || null,
        fetching: x.activeQueries.map(x => getQueryIdentifier(x)).join(","),
        success: x.successCount,
        failed: x.errorCount,
        latestError: x.latestError || null
      }));
  }

  public displayTable() {
    console.table(this.getNodeStatus().map(x => ({ ...x, latestError: x.latestError?.substring(0, 50) })));
  }
}

export const nodeAccessor = new NodeAccessor({ maxConcurrentQueryPerNode: concurrentNodeQuery });

function getQueryIdentifier(url: string) {
  if (url.startsWith("/block_results")) {
    return "r" + url.replace("/block_results?height=", "");
  } else if (url.startsWith("/block")) {
    return "b" + url.replace("/block?height=", "");
  } else {
    return url.substring(63);
  }
}
