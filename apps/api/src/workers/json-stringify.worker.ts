import { parentPort } from "worker_threads";

parentPort?.on("message", ({ id, data }: { id: number; data: unknown }) => {
  try {
    const json = JSON.stringify(data);
    parentPort?.postMessage({ id, json });
  } catch (error) {
    parentPort?.postMessage({ id, error: error instanceof Error ? error.message : "Stringify failed" });
  }
});
