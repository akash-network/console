import { LoggerService } from "../providers/logging.provider";

interface BenchmarkMetrics {
  totalDuration: number;
  checkpoints: Map<string, number>;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
  };
}

interface BenchmarkContext {
  startTime: number;
  checkpoints: Map<string, number>;
  logger: any;
  methodName: string;
  instanceId: string;
  metrics: BenchmarkMetrics;
}

class BenchmarkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BenchmarkError";
  }
}

export class BenchmarkContextManager {
  private static contexts = new Map<string, BenchmarkContext>();
  private static readonly CONTEXT_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  static createContext(methodName: string): string {
    // Clean old contexts first
    this.cleanupStaleContexts();
    const instanceId = `${methodName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const context: BenchmarkContext = {
      startTime: performance.now(),
      checkpoints: new Map(),
      logger: LoggerService.forContext("BENCHMARK"),
      methodName,
      instanceId,
      metrics: {
        totalDuration: 0,
        checkpoints: new Map(),
        memoryUsage: {
          heapUsed: 0,
          heapTotal: 0
        }
      }
    };
    this.contexts.set(instanceId, context);
    return instanceId;
  }

  static getContext(methodName: string): BenchmarkContext | undefined {
    return this.contexts.get(methodName);
  }

  static checkpoint(methodName: string, checkpointName: string) {
    const context = this.getContext(methodName);
    if (!context) {
      throw new BenchmarkError(`No benchmark context found for method ${methodName}`);
    }

    const currentTime = performance.now();
    const duration = currentTime - context.startTime;
    context.checkpoints.set(checkpointName, duration);
    context.logger.info(`Checkpoint "${checkpointName}" in ${context.methodName} reached after ${duration.toFixed(2)}ms`);
  }

  static end(methodName: string) {
    const context = this.getContext(methodName);
    if (!context) return;

    const endTime = performance.now();
    const totalDuration = endTime - context.startTime;

    const metrics: BenchmarkMetrics = {
      totalDuration,
      checkpoints: context.checkpoints,
      memoryUsage: {
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal
      }
    };

    // Log enhanced metrics
    context.logger.info({
      message: `Method ${context.methodName} completed`,
      duration: `${totalDuration.toFixed(2)}ms`,
      metrics
    });

    this.contexts.delete(methodName);
  }

  static error(methodName: string, error: Error) {
    const context = this.getContext(methodName);
    if (!context) return;

    const endTime = performance.now();
    const totalDuration = endTime - context.startTime;

    context.logger.error(`Method ${context.methodName} failed after ${totalDuration.toFixed(2)}ms - ${error.message}`);

    // Clean up
    this.contexts.delete(methodName);
  }

  private static cleanupStaleContexts() {
    const now = performance.now();
    for (const [id, context] of this.contexts.entries()) {
      if (now - context.startTime > this.CONTEXT_TIMEOUT) {
        this.contexts.delete(id);
        context.logger.warn(`Cleaned up stale benchmark context for ${context.methodName}`);
      }
    }
  }

  static validateContext(context: BenchmarkContext | undefined, methodName: string): asserts context is BenchmarkContext {
    if (!context) {
      throw new BenchmarkError(`No benchmark context found for method ${methodName}`);
    }
  }
}

export function Benchmark() {
  return function <T extends (...args: any[]) => Promise<any>>(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (this: any, ...args: Parameters<T>) {
      const instanceId = BenchmarkContextManager.createContext(propertyKey);

      try {
        const result = await originalMethod.apply(this, args);
        BenchmarkContextManager.end(instanceId);
        return result;
      } catch (error) {
        BenchmarkContextManager.error(instanceId, error);
        throw error;
      }
    } as T;

    return descriptor;
  };
}

// Helper function to add checkpoints in methods
export function checkpoint(name: string) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Create checkpoint before method execution
      const context = BenchmarkContextManager.getContext(_propertyKey);
      if (context) {
        BenchmarkContextManager.checkpoint(context.instanceId, `${name}_start`);
      }

      const result = await originalMethod.apply(this, args);

      // Create checkpoint after method execution
      if (context) {
        BenchmarkContextManager.checkpoint(context.instanceId, `${name}_end`);
      }

      return result;
    };

    return descriptor;
  };
}
