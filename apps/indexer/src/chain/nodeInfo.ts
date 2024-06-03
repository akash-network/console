import axios from "axios";

import { sleep } from "@src/shared/utils/delay";

const RateLimitWaitingPeriod = 2 * 60_000; // 2 minutes
const LateNodeWaitingPeriod = 5 * 60_000; // 5 minutes
const UnavailableShortWaitingPeriod = 1 * 60_000; // 1 minutes
const UnavailableLongWaitingPeriod = 5 * 60_000; // 5 minutes
const LateNodeThreshold = 2;
const QueryTimeout = 60_000; // 60 seconds

enum HttpCodes {
  TOO_MANY_REQUESTS = 429
}

export enum NodeStatus {
  OK = "OK",
  UNAVAILABLE = "UNAVAILABLE",
  UNKNOWN = "UNKNOWN",
  RATE_LIMIT = "RATE_LIMIT",
  LATE = "LATE"
}

export interface SavedNodeInfo {
  url: string;
  status: NodeStatus;
  earliestBlockHeight: number;
  maxConcurrentQuery: number;
  delayBetweenRequests: number;
}

export class NodeInfo {
  url: string;
  activeQueries: string[];
  successCount: number;
  errorCount: number;
  latestError?: string;
  lastErrorDate?: Date;
  lastQueryDate?: Date;
  status: NodeStatus;
  earliestBlockHeight?: number;
  maxConcurrentQuery: number;
  delayBetweenRequests: number;

  constructor(url: string, maxConcurrentQuery: number) {
    this.url = url;
    this.activeQueries = [];
    this.successCount = 0;
    this.errorCount = 0;
    this.status = NodeStatus.UNKNOWN;
    this.earliestBlockHeight = undefined;
    this.maxConcurrentQuery = maxConcurrentQuery;
    this.delayBetweenRequests = 0;
  }

  public getSavedNodeInfo(): SavedNodeInfo {
    return {
      url: this.url,
      status: this.status,
      maxConcurrentQuery: this.maxConcurrentQuery,
      delayBetweenRequests: this.delayBetweenRequests,
      earliestBlockHeight: this.earliestBlockHeight
    };
  }

  public loadFromSavedNodeInfo(savedNodeInfo: SavedNodeInfo) {
    this.status = savedNodeInfo.status;
    this.maxConcurrentQuery = savedNodeInfo.maxConcurrentQuery;
    this.delayBetweenRequests = savedNodeInfo.delayBetweenRequests;
    this.earliestBlockHeight = savedNodeInfo.earliestBlockHeight;

    switch (this.status) {
      case NodeStatus.RATE_LIMIT:
        setTimeout(() => {
          this.updateStatus();
        }, RateLimitWaitingPeriod);
        break;
      case NodeStatus.LATE:
        setTimeout(() => {
          this.updateStatus();
        }, LateNodeWaitingPeriod);
        break;
      case NodeStatus.UNAVAILABLE:
        this.handleUnavailable();
        break;
      case NodeStatus.UNKNOWN:
        this.updateStatus();
        break;
    }
  }

  private async handleUnavailable() {
    setTimeout(
      () => {
        this.updateStatus();
      },
      this.successCount > 50 ? UnavailableShortWaitingPeriod : UnavailableLongWaitingPeriod
    );
  }

  public async updateStatus(): Promise<void> {
    return axios
      .get(`${this.url}/status`, { timeout: QueryTimeout })
      .then((res) => {
        this.status = NodeStatus.OK;
        this.earliestBlockHeight = parseInt(res.data.result.sync_info.earliest_block_height);
      })
      .catch((err) => {
        this.status = NodeStatus.UNAVAILABLE;
        this.latestError = err.message || "Unknown error";

        if (err.response?.status === HttpCodes.TOO_MANY_REQUESTS) {
          this.handleRateLimiting();
        } else {
          this.handleUnavailable();
        }
      });
  }

  public isAvailable(height?: number): boolean {
    return this.status === NodeStatus.OK && (!height || this.earliestBlockHeight <= height) && this.activeQueries.length < this.maxConcurrentQuery;
  }

  private handleRateLimiting() {
    this.status = NodeStatus.RATE_LIMIT;

    if (!this.lastErrorDate || new Date().getTime() - this.lastErrorDate.getTime() > 60_000) {
      if (this.maxConcurrentQuery > 1) {
        this.maxConcurrentQuery--;
      } else {
        this.delayBetweenRequests += 500;

        if (this.delayBetweenRequests > 5_000) {
          this.status = NodeStatus.UNAVAILABLE;
        }
      }

      setTimeout(() => {
        this.updateStatus();
      }, RateLimitWaitingPeriod);
    }
  }

  private handleMissingBlock(requestedHeight: number, latestHeight: number) {
    if (requestedHeight - latestHeight <= LateNodeThreshold) return;

    if (!this.lastErrorDate || new Date().getTime() - this.lastErrorDate.getTime() > LateNodeWaitingPeriod) {
      this.status = NodeStatus.LATE;

      setTimeout(() => {
        this.updateStatus();
      }, LateNodeWaitingPeriod);
    }
  }

  public async query(path: string, height?: number) {
    this.activeQueries.push(path);

    if (this.delayBetweenRequests && this.lastQueryDate) {
      const msDiff = new Date().getTime() - this.lastQueryDate.getTime();

      if (msDiff < this.delayBetweenRequests) {
        await sleep(this.delayBetweenRequests - msDiff);
      }
    }

    try {
      const response = await axios.get(`${this.url}${path}`, { timeout: QueryTimeout });
      this.successCount++;
      return response.data;
    } catch (err) {
      const rpcError = err.response?.data?.error?.data;
      let error = err.message || "Unknown error";

      if (err.response?.status === HttpCodes.TOO_MANY_REQUESTS) {
        this.handleRateLimiting();
      } else if (height && rpcError) {
        if (/^height \d+ must be less than or equal to the current blockchain height \d+$/i.test(rpcError)) {
          error = "Block was missing";
          this.handleMissingBlock(height, parseInt(/blockchain height (\d+)$/i.exec(rpcError)[1]));
        } else if (/^height \d+ is not available, lowest height is \d+$/i.test(rpcError)) {
          error = "Block was pruned";
          this.earliestBlockHeight = parseInt(/lowest height is (\d+)$/i.exec(rpcError)[1]);
        }
      } else {
        this.status = NodeStatus.UNAVAILABLE;
        this.handleUnavailable();
      }

      this.errorCount++;
      this.latestError = error;
      this.lastErrorDate = new Date();
      this.errorCount++;
      throw err;
    } finally {
      this.activeQueries = this.activeQueries.filter((x) => x !== path);
      this.lastQueryDate = new Date();
    }
  }
}
