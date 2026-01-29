import fs from "fs";
import path from "path";
import { Worker } from "worker_threads";

let worker: Worker | null = null;
let workerDisabled = false;
let nextId = 0;
const pending = new Map<number, { resolve: (json: string) => void; reject: (err: Error) => void }>();

function resolveWorkerPath(): string | null {
  // Built output: __dirname is dist/, worker at dist/workers/json-stringify.worker.js
  const builtPath = path.join(__dirname, "workers", "json-stringify.worker.js");
  if (fs.existsSync(builtPath)) return builtPath;

  return null;
}

function getWorker(): Worker | null {
  if (workerDisabled) return null;

  if (!worker) {
    const workerPath = resolveWorkerPath();
    if (!workerPath) {
      workerDisabled = true;
      return null;
    }

    worker = new Worker(workerPath);

    worker.on("message", ({ id, json, error }: { id: number; json?: string; error?: string }) => {
      const entry = pending.get(id);
      if (entry) {
        pending.delete(id);
        if (error) {
          entry.reject(new Error(error));
        } else {
          entry.resolve(json!);
        }
      }
    });

    worker.on("error", err => {
      for (const entry of pending.values()) {
        entry.reject(err);
      }
      pending.clear();
      workerDisabled = true;
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
  const w = getWorker();

  if (!w) {
    return Promise.resolve(JSON.stringify(data));
  }

  return new Promise<string>((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });

    try {
      w.postMessage({ id, data });
    } catch (err) {
      pending.delete(id);
      try {
        resolve(JSON.stringify(data));
      } catch (stringifyErr) {
        reject(stringifyErr);
      }
    }
  });
}
