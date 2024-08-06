import { AsyncLocalStorage } from "node:async_hooks";
import { singleton } from "tsyringe";

@singleton()
export class ExecutionContextService {
  private readonly storage = new AsyncLocalStorage<Map<string, any>>();

  private get context() {
    const store = this.storage.getStore();

    if (!store) {
      throw new Error("No context available");
    }

    return store;
  }

  set(key: string, value: any) {
    this.context.set(key, value);
  }

  get(key: string) {
    return this.context.get(key);
  }

  async runWithContext<R>(cb: (...args: any[]) => Promise<R>): Promise<R> {
    return await new Promise((resolve, reject) => {
      this.storage.run(new Map(), () => {
        this.storage.getStore();
        cb().then(resolve).catch(reject);
      });
    });
  }
}
