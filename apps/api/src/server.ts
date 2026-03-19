import { parentPort, Worker } from "node:worker_threads";

import type { RawAppConfig } from "./core/providers/raw-app-config.provider";
import { bootstrapEntry } from "./bootstrap-entry";

const SUPPORTED_INTERFACES = ["rest", "background-jobs"];

bootstrap(process.env as RawAppConfig);

async function bootstrap(rawAppConfig: RawAppConfig): Promise<void> {
  const INTERFACE = rawAppConfig.INTERFACE || "all";
  const port = parseInt(rawAppConfig.PORT?.toString() || "3080", 10) || 3080;

  if (INTERFACE === "all") {
    const workers = SUPPORTED_INTERFACES.map((interfaceName, index) => bootstrapInWorker({ PORT: String(port + index), INTERFACE: interfaceName }));
    await Promise.all(workers.map(w => w.ready));

    const forwardSignal = (signal: string) => {
      workers.forEach(w => w.ref.postMessage(signal));
    };
    process.on("SIGTERM", () => forwardSignal("SIGTERM"));
    process.on("SIGINT", () => forwardSignal("SIGINT"));

    await Promise.all(workers.map(w => w.exited));
    return;
  }

  if (parentPort) {
    parentPort.on("message", (code: string) => {
      if (code === "SIGTERM" || code === "SIGINT") {
        parentPort?.unref();
        process.emit(code, code);
      }
    });
  }

  let appModule: { bootstrap: () => Promise<void> };
  switch (INTERFACE) {
    case "rest":
      appModule = await bootstrapEntry(() => import("./rest-app.ts"));
      break;
    case "background-jobs":
      appModule = await bootstrapEntry(() => import("./background-jobs-app.ts"));
      break;
    default:
      throw new Error(`Received invalid interface: ${INTERFACE}. Valid values: ${SUPPORTED_INTERFACES.join(", ")}`);
  }

  await appModule.bootstrap();
  parentPort?.postMessage("ready");
}

function bootstrapInWorker({ PORT, INTERFACE }: RawAppConfig) {
  const ref = new Worker(__filename, {
    env: {
      ...process.env,
      PORT: String(PORT),
      INTERFACE: String(INTERFACE)
    }
  });

  const ready = new Promise<void>((resolve, reject) => {
    const onMessage = (m: unknown) => {
      if (m === "ready") {
        cleanup();
        resolve();
      }
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const onExit = (code: number) => {
      cleanup();
      reject(new Error(`[${INTERFACE}] exited with code ${code} before ready`));
    };
    const cleanup = () => {
      ref.off("message", onMessage);
      ref.off("error", onError);
      ref.off("exit", onExit);
    };
    ref.on("message", onMessage);
    ref.once("error", onError);
    ref.once("exit", onExit);
  });

  const exited = new Promise<void>(resolve => {
    ref.once("exit", resolve);
    ref.once("error", resolve);
  });

  return { ref, ready, exited };
}
