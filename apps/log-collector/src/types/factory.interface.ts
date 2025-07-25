/**
 * Generic factory interface for creating service instances
 *
 * Provides a standardized way to create service instances with dependencies.
 * Factories are used to create dedicated service instances per pod or other
 * contextual requirements.
 *
 * @template T - The type of service to create
 * @template P - The type of parameters required to create the service
 */
export interface Factory<T, P extends any[] = any[]> {
  /**
   * Creates a new instance of the service
   *
   * @param params - Parameters required to create the service instance
   * @returns A new service instance
   */
  create(...params: P): T;
}
