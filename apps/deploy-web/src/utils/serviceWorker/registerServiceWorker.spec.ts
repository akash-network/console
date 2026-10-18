import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ServiceWorkerRegistrar } from "./registerServiceWorker";
import { registerServiceWorker } from "./registerServiceWorker";

describe(registerServiceWorker.name, () => {
  it("registers the service worker", async () => {
    const { registrar, logger } = setup({ registration: Promise.resolve() });

    await registerServiceWorker(registrar, logger);

    expect(registrar.register).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns instead of leaving the rejection unhandled when the browser refuses the worker", async () => {
    const refusal = new TypeError("Failed to register a ServiceWorker for scope ('https://console.akash.network/'): Failed to access storage.");
    const { registrar, logger } = setup({ registration: Promise.reject(refusal) });

    await registerServiceWorker(registrar, logger);

    expect(logger.warn).toHaveBeenCalledWith({ event: "SERVICE_WORKER_REGISTRATION_FAILED", error: refusal });
  });

  it("does nothing where the browser has no service worker support", async () => {
    const { logger } = setup({ registration: Promise.resolve() });

    await registerServiceWorker(undefined, logger);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  function setup(input: { registration: Promise<unknown> }) {
    const registrar = mock<ServiceWorkerRegistrar>({ register: vi.fn(() => input.registration) });
    const logger = mock<LoggerService>();
    return { registrar, logger };
  }
});
