import type { LoggerService } from "@akashnetwork/logging";

export interface ServiceWorkerRegistrar {
  register(): Promise<unknown>;
}

declare global {
  interface Window {
    /** Built by next-pwa's register script, and only in a browser that supports service workers. */
    workbox?: ServiceWorkerRegistrar;
  }
}

/** The app runs without its worker, so a browser refusing it (blocked storage, a dropped fetch of sw.js) is no fault of ours. */
export async function registerServiceWorker(registrar: ServiceWorkerRegistrar | undefined, logger: LoggerService): Promise<void> {
  try {
    await registrar?.register();
  } catch (error) {
    logger.warn({ event: "SERVICE_WORKER_REGISTRATION_FAILED", error });
  }
}
