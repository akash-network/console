import { singleton } from "tsyringe";

/**
 * Service for handling and aggregating errors from concurrent operations
 *
 * Provides a centralized way to handle errors from multiple concurrent operations,
 * aggregate them, and throw aggregated errors when needed.
 */
@singleton()
export class ErrorHandlerService {
  /**
   * Handles the results of concurrent operations and aggregates any errors
   *
   * Waits for all promises to settle, then aggregates any errors that occurred.
   * If any operations failed, throws an AggregateError containing all individual errors.
   *
   * @param promises - Array of promises representing concurrent operations
   * @param context - Context information for logging (e.g., pod names, container names)
   * @param operationName - Name of the operation being performed (for logging)
   * @returns Promise that resolves when all operations have completed successfully
   * @throws AggregateError if any operations failed
   */
  async aggregateConcurrentResults<T>(promises: Promise<T>[], context: Record<string, any>, operationName: string): Promise<T[]> {
    const results = await Promise.allSettled(promises);

    const errors: Error[] = [];
    const successfulResults: T[] = [];

    results.forEach(result => {
      if (result.status === "rejected") {
        errors.push(result.reason);
      } else {
        successfulResults.push(result.value);
      }
    });

    if (errors.length > 0) {
      return Promise.reject(new AggregateError(errors, `${operationName} failed for ${errors.length} item(s)`));
    }

    return successfulResults;
  }
}
