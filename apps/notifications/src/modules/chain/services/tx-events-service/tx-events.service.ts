import type { BlockResultsResponse } from "@cosmjs/tendermint-rpc";
import { Tendermint34Client, TxData } from "@cosmjs/tendermint-rpc";
import { Injectable } from "@nestjs/common";
import { backOff } from "exponential-backoff";

import { LoggerService } from "@src/common/services/logger/logger.service";

interface ProcessedEvent {
  type: string;
  module: string;
  action: string;
  [key: string]: string;
}

interface EventFilter {
  type?: string;
  action?: string | string[];
}

interface LogEvent {
  type: string;
  attributes: Array<{
    key: string;
    value: string;
  }>;
}

interface LogEntry {
  events: LogEvent[];
}

interface ModuleActionGroup {
  type: string;
  module: string;
  action: string;
  attributes: Record<string, string>;
}

@Injectable()
export class TxEventsService {
  constructor(
    private readonly tendermint34Client: Tendermint34Client,
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
    return await backOff(() => this.tendermint34Client.blockResults(blockHeight), {
      maxDelay: 7_000,
      startingDelay: 500,
      timeMultiple: 2,
      numOfAttempts: 5,
      jitter: "none"
    });
  }

  /**
   * Extracts and filters events from block results
   * @param blockResults - The block results containing transaction logs
   * @param filter - Optional filter to apply to events
   * @returns Array of processed events matching the filter criteria
   */
  private extractFilteredEventsFromBlockResults(blockResults: BlockResultsResponse, filter?: EventFilter): ProcessedEvent[] {
    const allProcessedEvents: ProcessedEvent[] = [];

    for (const transactionResult of blockResults.results) {
      if (!transactionResult.log) {
        continue;
      }

      const parsedTransactionLog = this.parseTransactionLog(transactionResult);
      if (!parsedTransactionLog || !Array.isArray(parsedTransactionLog)) {
        continue;
      }

      const eventsFromTransaction = this.processAllEventsInTransaction(parsedTransactionLog, filter);
      allProcessedEvents.push(...eventsFromTransaction);
    }

    return allProcessedEvents;
  }

  /**
   * Parses a transaction log from JSON string to object
   * @param transaction - The transaction data containing the log
   * @returns Parsed log object or undefined if parsing fails
   */
  private parseTransactionLog(transaction: TxData): LogEntry | undefined {
    try {
      return transaction.log && JSON.parse(transaction.log);
    } catch (error) {
      this.loggerService.error({
        event: "TRANSACTION_LOG_PARSING_FAILED",
        error,
        log: transaction.log
      });
      return undefined;
    }
  }

  /**
   * Processes all events within a single transaction log entry
   * @param transactionLogEntries - Array of log entries from a transaction
   * @param filter - Optional filter to apply to events
   * @returns Array of processed events from this transaction
   */
  private processAllEventsInTransaction(transactionLogEntries: LogEntry[], filter?: EventFilter): ProcessedEvent[] {
    const moduleActionEventsFromTransaction: ProcessedEvent[] = [];

    for (const logEntry of transactionLogEntries) {
      if (!logEntry.events || !Array.isArray(logEntry.events)) {
        continue;
      }

      const filteredEvents = this.filterEventsByType(logEntry.events, filter);
      const events = this.extractModuleActionEventsFromTxEvents(filteredEvents, filter);
      moduleActionEventsFromTransaction.push(...events);
    }

    return moduleActionEventsFromTransaction;
  }

  /**
   * Filters events by type if a filter is specified
   * @param events - Array of events to filter
   * @param filter - Optional filter containing type criteria
   * @returns Filtered array of events
   */
  private filterEventsByType(events: LogEvent[], filter?: EventFilter): LogEvent[] {
    if (!filter?.type) {
      return events;
    }

    return events.filter((event: LogEvent) => event.type === filter.type);
  }

  /**
   * Extracts module-action events from a collection of filtered events
   * @param events - Array of events to process
   * @param filter - Optional filter to apply during processing
   * @returns Array of processed events
   */
  private extractModuleActionEventsFromTxEvents(events: LogEvent[], filter?: EventFilter): ProcessedEvent[] {
    const processedEvents: ProcessedEvent[] = [];

    for (const event of events) {
      const eventsFromSingleEvent = this.extractModuleActionEventsFromSingleEvent(event, filter);
      processedEvents.push(...eventsFromSingleEvent);
    }

    return processedEvents;
  }

  /**
   * Extracts module-action events from a single event by grouping attributes
   * @param event - The event to process
   * @param filter - Optional filter to apply during processing
   * @returns Array of processed events from this single event
   */
  private extractModuleActionEventsFromSingleEvent(event: LogEvent, filter?: EventFilter): ProcessedEvent[] {
    if (filter?.type && event.type !== filter.type) {
      return [];
    }

    const moduleActionGroups = this.groupAttributesByModuleAndAction(event.attributes, event.type);
    return this.convertGroupsToProcessedEvents(moduleActionGroups, filter);
  }

  /**
   * Groups event attributes by unique (module, action) pairs
   * @param attributes - Array of event attributes
   * @param eventType - The type of the event being processed
   * @returns Record of module-action groups with their attributes
   */
  private groupAttributesByModuleAndAction(attributes: Array<{ key: string; value: string }>, eventType: string): Record<string, ModuleActionGroup> {
    const moduleActionGroups: Record<string, ModuleActionGroup> = {};
    let currentModule = "";
    let currentAction = "";

    for (const attribute of attributes) {
      if (attribute.key === "module") {
        currentModule = attribute.value;
        currentAction = "";
      }
      if (attribute.key === "action") {
        currentAction = attribute.value;
      }

      if (currentModule && currentAction) {
        const groupKey = this.createModuleActionGroupKey(currentModule, currentAction);

        if (!moduleActionGroups[groupKey]) {
          moduleActionGroups[groupKey] = {
            type: eventType,
            module: currentModule,
            action: currentAction,
            attributes: {}
          };
        }

        moduleActionGroups[groupKey].attributes[attribute.key] = attribute.value;
      }
    }

    return moduleActionGroups;
  }

  /**
   * Creates a unique key for a module-action group
   * @param module - The module name
   * @param action - The action name
   * @returns Unique key string
   */
  private createModuleActionGroupKey(module: string, action: string): string {
    return `${module}::${action}`;
  }

  /**
   * Converts module-action groups to processed events, applying filters
   * @param moduleActionGroups - Record of module-action groups
   * @param filter - Optional filter to apply
   * @returns Array of processed events
   */
  private convertGroupsToProcessedEvents(moduleActionGroups: Record<string, ModuleActionGroup>, filter?: EventFilter): ProcessedEvent[] {
    const processedEvents: ProcessedEvent[] = [];

    for (const group of Object.values(moduleActionGroups)) {
      if (this.shouldIncludeGroupInResults(group, filter)) {
        const processedEvent = this.createProcessedEventFromGroup(group);
        processedEvents.push(processedEvent);
      }
    }

    return processedEvents;
  }

  /**
   * Determines if a module-action group should be included in results based on filter criteria
   * @param group - The module-action group to evaluate
   * @param filter - Optional filter criteria
   * @returns True if the group should be included, false otherwise
   */
  private shouldIncludeGroupInResults(group: ModuleActionGroup, filter?: EventFilter): boolean {
    if (group.module !== "deployment") {
      return false;
    }

    if (filter?.action) {
      const allowedActions = Array.isArray(filter.action) ? filter.action : [filter.action];
      if (!allowedActions.includes(group.action)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Creates a processed event object from a module-action group
   * @param group - The module-action group to convert
   * @returns Processed event object
   */
  private createProcessedEventFromGroup(group: ModuleActionGroup): ProcessedEvent {
    return {
      type: group.type,
      module: group.module,
      action: group.action,
      ...group.attributes
    };
  }
}
