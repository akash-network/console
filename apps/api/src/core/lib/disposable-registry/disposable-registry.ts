import { container, Disposable, FactoryProvider, singleton } from "tsyringe";

/**
 * Registry for managing disposable resources created from factory providers.
 *
 * This service tracks disposable instances created through factory functions
 * and ensures they are properly disposed when the registry itself is disposed.
 * Useful for cleaning up resources like database connections, clients, or other
 * objects that require explicit cleanup.
 */
@singleton()
export class DisposableRegistry implements Disposable {
  /**
   * Wraps a factory function to automatically register disposable instances.
   *
   * This static method resolves the registry instance from the container and
   * delegates to the instance method. Use this when registering providers
   * that may return disposable instances.
   *
   * @param factory - The factory function to wrap.
   * @returns A wrapped factory function that registers disposables automatically.
   */
  static registerFromFactory<T>(factory: FactoryProvider<T>["useFactory"]): FactoryProvider<T>["useFactory"] {
    return container.resolve(DisposableRegistry).registerFromFactory(factory);
  }

  #isDisposed = false;
  readonly #disposables: Disposable[] = [];

  /**
   * Wraps a factory function to automatically register disposable instances.
   *
   * When the wrapped factory is called and returns a value that implements
   * the Disposable interface, the dispose method is registered for later cleanup.
   * Non-disposable values are returned without modification.
   *
   * @param factory - The factory function to wrap.
   * @returns A wrapped factory function that registers disposables automatically.
   */
  registerFromFactory<T>(factory: FactoryProvider<T>["useFactory"]): FactoryProvider<T>["useFactory"] {
    return container => {
      const value = factory(container);
      if (this.isDisposable(value)) {
        this.register(value as Disposable);
      }

      return value;
    };
  }

  register(item: Disposable): void {
    this.#disposables.push(item);
  }

  /**
   * Disposes all registered disposable instances.
   *
   * Calls the dispose method on all registered disposables concurrently.
   * Uses Promise.allSettled to ensure all dispose operations are attempted,
   * even if some fail. If any dispose operations fail, throws an AggregateError
   * containing all failure reasons.
   *
   * This method is idempotent - calling it multiple times is safe and will only
   * dispose resources once. Subsequent calls after the first disposal will return
   * immediately without performing any operations.
   *
   * @returns A promise that resolves when all dispose operations complete successfully.
   * @throws AggregateError if any dispose operations failed, containing all failure reasons.
   */
  async dispose(): Promise<void> {
    if (this.#isDisposed) {
      return;
    }

    this.#isDisposed = true;

    const results = await Promise.allSettled(this.#disposables.map(item => item.dispose()));
    const errors = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    this.#disposables.length = 0;

    if (errors.length > 0) {
      throw new AggregateError(
        errors.map(e => e.reason),
        `Failed to dispose ${errors.length} resource(s)`
      );
    }
  }

  /**
   * Checks if a value implements the Disposable interface.
   *
   * @param value - The value to check.
   * @returns `true` if the value is disposable, `false` otherwise.
   */
  private isDisposable(value: unknown): value is Disposable {
    return !!(value && typeof value === "object" && "dispose" in value && typeof value.dispose === "function");
  }
}
