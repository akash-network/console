import type { MongoAbility } from "@casl/ability";
import { AsyncLocalStorage } from "node:async_hooks";
import { singleton } from "tsyringe";

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
}

@singleton()
export class ExecutionContextService {
  private readonly storage = new AsyncLocalStorage<Map<string, unknown>>();

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

  async runWithContext<R>(cb: (...args: any[]) => Promise<R>): Promise<R> {
    return this.storage.run(new Map(), cb);
  }
}
