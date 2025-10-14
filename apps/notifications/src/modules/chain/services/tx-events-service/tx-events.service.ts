import { Comet38Client } from "@cosmjs/tendermint-rpc";
import { BlockResultsResponse, Event } from "@cosmjs/tendermint-rpc/build/comet38";
import { Injectable } from "@nestjs/common";
import { backOff } from "exponential-backoff";

import { LoggerService } from "@src/common/services/logger/logger.service";

/**
 * Represents a processed blockchain event with standardized structure
 */
interface ProcessedEvent {
  type: string;
  module: string;
  action: string;
  [key: string]: string;
}

/**
 * Supported blockchain event actions
 */
type Action = "deployment-closed" | "deployment-created";

/**
 * Filter criteria for blockchain events
 */
interface EventFilter {
  source?: "akash";
  action?: Action | Action[];
  module?: "deployment";
  version?: "v1";
}

/**
 * Service for fetching and processing blockchain transaction events from Tendermint/Comet38.
 * Handles event filtering, parsing, and transformation to a standardized format.
 *
 * Features:
 * - Fetches block results using Comet38Client with exponential backoff retry
 * - Filters events by source, module, version, and action
 * - Transforms raw blockchain events to standardized v1 format
 * - Handles both new Comet38 event format and legacy format
 * - Robust error handling with detailed logging
 * - Graceful handling of malformed JSON in event attributes
 */
@Injectable()
export class TxEventsService {
  private readonly EVENT_ACTIONS: Record<string, string> = {
    EventDeploymentClosed: "deployment-closed",
    EventDeploymentCreated: "deployment-created"
  };

  private readonly ACTION_EVENTS: Record<string, string> = Object.fromEntries(Object.entries(this.EVENT_ACTIONS).map(([k, v]) => [v, k]));

  private readonly EXCLUDE_PROPS = new Set(["msg_index"]);

  constructor(
    private readonly comet38Client: Comet38Client,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(TxEventsService.name);
  }

  /**
   * Retrieves and processes block events filtered by type and action
   * @param blockHeight - The height of the block to process
   * @param filter - Optional filter to apply to events
   * @returns Array of processed events matching the filter criteria
   */
  async getBlockEvents(blockHeight: number, filter?: EventFilter): Promise<ProcessedEvent[]> {
    try {
      const blockResults = await this.fetchBlockResultsWithRetry(blockHeight);

      this.loggerService.debug({
        event: "BLOCK_RESULTS_FETCHED",
        blockHeight,
        transactionCount: blockResults.results.length
      });

      return this.extractFilteredEventsFromBlockResults(blockResults, filter);
    } catch (error) {
      this.loggerService.error({
        event: "BLOCK_EVENTS_PROCESSING_FAILED",
        blockHeight,
        error
      });
      return [];
    }
  }

  /**
   * Fetches block results from Tendermint with exponential backoff retry logic
   * @param blockHeight - The height of the block to fetch
   * @returns Block results response from Tendermint
   */
  private async fetchBlockResultsWithRetry(blockHeight: number): Promise<BlockResultsResponse> {
    return await backOff(() => this.comet38Client.blockResults(blockHeight), {
      maxDelay: 7_000,
      startingDelay: 500,
      timeMultiple: 2,
      numOfAttempts: 5,
      jitter: "none"
    });
  }

  /**
   * Extracts and filters events from block results, processing all transaction results
   * @param blockResults - The block results containing transaction events
   * @param filter - Optional filter to apply to events (source, module, version, action)
   * @returns Array of processed events matching the filter criteria
   */
  private extractFilteredEventsFromBlockResults(blockResults: BlockResultsResponse, filter?: EventFilter): ProcessedEvent[] {
    return blockResults.results
      .map(result => {
        let events: Event[] = [];

        if (filter) {
          const regexp = this.toFilterRegexp(filter);
          events = result.events.filter(event => regexp.test(event.type));
        } else {
          events = [...result.events];
        }

        return this.transformEventsToV1Format(events);
      })
      .flat();
  }

  /**
   * Creates a regular expression pattern for filtering events based on filter criteria
   * @param filter - The filter criteria (source, module, version, action)
   * @param flags - Optional regex flags
   * @returns Regular expression for matching event types
   */
  private toFilterRegexp(filter: EventFilter, flags: string = ""): RegExp {
    const source = filter.source ? this.escape(filter.source) : ".*";
    const module = filter.module ? this.escape(filter.module) : ".*";
    const version = filter.version ? this.escape(filter.version) : ".*";
    const action = filter.action ? this.buildAction(filter.action) : ".*";

    const pattern = `^${source}\\.${module}\\.${version}\\.${action}$`;
    return new RegExp(pattern, flags);
  }

  /**
   * Escapes special regex characters in a string
   * @param str - The string to escape
   * @returns Escaped string safe for use in regex patterns
   */
  private escape(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Builds a regex pattern for matching action names
   * @param action - Single action or array of actions to match
   * @returns Regex pattern string for matching actions
   */
  private buildAction(action: Action | Action[]): string {
    const chainEvents = this.resolveEventNames(action);
    return `(?:${chainEvents.map(a => this.escape(a)).join("|")})`;
  }

  /**
   * Resolves action names to their corresponding blockchain event names
   * @param action - Single action or array of actions
   * @returns Array of resolved event names
   */
  private resolveEventNames(action: Action | Action[]): string[] {
    const list = Array.isArray(action) ? action : [action];
    return list.map(a => this.ACTION_EVENTS[a] ?? a);
  }

  /**
   * Transforms raw blockchain events to standardized v1 format.
   * Handles both new Comet38 format (akash.deployment.v1.EventDeploymentCreated)
   * and legacy format (akash.v1) events.
   *
   * @param events - Array of raw blockchain events
   * @returns Array of processed events in standardized format
   */
  private transformEventsToV1Format(events: Event[]): ProcessedEvent[] {
    return events.map(event => {
      const [source, module, version, chainEvent] = event.type.split(".");
      const processedEvent: ProcessedEvent = {
        type: `${source}.${version}`,
        action: this.EVENT_ACTIONS[chainEvent] || chainEvent,
        module
      };
      return event.attributes.reduce((acc, attribute) => {
        try {
          const value = JSON.parse(attribute.value);
          if (this.EXCLUDE_PROPS.has(attribute.key)) {
            return acc;
          }

          if (attribute.key === "id") {
            Object.assign(acc, value);
          } else {
            acc[attribute.key] = value;
          }
          return acc;
        } catch (error) {
          this.loggerService.error({
            event: "EVENT_PROPERTY_PARSING_FAILED",
            error,
            payload: event
          });
          return acc;
        }
      }, processedEvent);
    });
  }
}
