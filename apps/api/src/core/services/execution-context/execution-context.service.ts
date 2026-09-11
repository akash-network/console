import type { MongoAbility } from "@casl/ability";
import { AsyncLocalStorage } from "node:async_hooks";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import type { UserOutput } from "@src/user/repositories";
import type { AppContext } from "../../types/app-context";

/** A data key held for one request: the record's identity is free, the key behind it costs a key-service call. */
export interface HeldDataKey {
  readonly id: string;
  unwrap(): Promise<Buffer>;
}

interface ExecutionStorage {
  CURRENT_USER: UserOutput;
  ABILITY: MongoAbility;
  HTTP_CONTEXT: AppContext;
  HELD_DATA_KEYS: Map<string, Promise<HeldDataKey>>;
  DATA_KEY_UNWRAP_COUNTS: Map<string, number>;
}

@singleton()
export class ExecutionContextService {
  private readonly storage = new AsyncLocalStorage<Map<string, unknown>>();
  private readonly contextEndCallbacks: Array<() => void> = [];
  private readonly logger: ReturnType<CreateLogger>;

  constructor(@inject(LOGGER_FACTORY) createLogger: CreateLogger) {
    this.logger = createLogger({ context: ExecutionContextService.name });
  }

  private get context() {
    const store = this.storage.getStore();

    if (!store) {
      throw new Error("No context available");
    }

    return store;
  }

  /** Whether a store exists at all, so a caller can distinguish "no request" from "nothing stored" without catching. */
  hasContext(): boolean {
    return this.storage.getStore() !== undefined;
  }

  set<K extends keyof ExecutionStorage>(key: K, value: ExecutionStorage[K] | undefined) {
    this.context.set(key, value);
  }

  get<K extends keyof ExecutionStorage>(key: K): ExecutionStorage[K] | undefined {
    return this.context.get(key) as ExecutionStorage[K] | undefined;
  }

  /** Registered per process and run for every context, so a per-request measurement reaches the job and CLI entry points and not only the HTTP one. */
  onContextEnd(callback: () => void) {
    this.contextEndCallbacks.push(callback);
  }

  async runWithContext<R>(cb: (...args: any[]) => Promise<R>): Promise<R> {
    return this.storage.run(new Map(), async () => {
      try {
        return await cb();
      } finally {
        this.endContext();
      }
    });
  }

  /** A callback throwing from that finally would replace the work's own result or error, so none of them is trusted to return. */
  private endContext() {
    for (const callback of this.contextEndCallbacks) {
      try {
        callback();
      } catch (error) {
        this.logger.error({ event: "EXECUTION_CONTEXT_END_CALLBACK_FAILED", error });
      }
    }
  }
}
