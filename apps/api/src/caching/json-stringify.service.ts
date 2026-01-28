import path from "path";
import { Worker } from "worker_threads";

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (json: string) => void; reject: (err: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(path.join(__dirname, "workers", "json-stringify.worker.js"));

    worker.on("message", ({ id, json }: { id: number; json: string }) => {
      const entry = pending.get(id);
      if (entry) {
        pending.delete(id);
        entry.resolve(json);
      }
    });

    worker.on("error", err => {
      for (const entry of pending.values()) {
        entry.reject(err);
      }
      pending.clear();
      worker = null;
    });

    worker.on("exit", () => {
      for (const entry of pending.values()) {
        entry.reject(new Error("Worker exited unexpectedly"));
      }
      pending.clear();
      worker = null;
    });
  }

  return worker;
}

export function stringifyAsync(data: unknown): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });

    try {
      getWorker().postMessage({ id, data });
    } catch (err) {
      pending.delete(id);
      // Fall back to main-thread stringify
      try {
        resolve(JSON.stringify(data));
      } catch (stringifyErr) {
        reject(stringifyErr);
      }
    }
  });
}
