import { parentPort } from "worker_threads";

parentPort?.on("message", ({ id, data }: { id: number; data: unknown }) => {
  const json = JSON.stringify(data);
  parentPort?.postMessage({ id, json });
});
