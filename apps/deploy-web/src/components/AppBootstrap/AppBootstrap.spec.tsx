import type { LoggerService } from "@akashnetwork/logging";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ServiceWorkerRegistrar } from "@src/utils/serviceWorker/registerServiceWorker";
import type { DEPENDENCIES } from "./AppBootstrap";
import { AppBootstrap } from "./AppBootstrap";

import { render } from "@testing-library/react";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(AppBootstrap.name, () => {
  afterEach(() => {
    delete window.workbox;
  });

  it("applies local storage migrations once", () => {
    const { migrateLocalStorage } = setup();

    expect(migrateLocalStorage).toHaveBeenCalledTimes(1);
  });

  it("forgets the storage older releases left behind once", () => {
    const { forgetRetiredStorage } = setup();

    expect(forgetRetiredStorage).toHaveBeenCalledTimes(1);
    expect(forgetRetiredStorage).toHaveBeenCalledWith(window.localStorage);
  });

  it("registers the page's service worker once with the app logger", () => {
    const { registerServiceWorker, workbox, logger } = setup();

    expect(registerServiceWorker).toHaveBeenCalledTimes(1);
    expect(registerServiceWorker).toHaveBeenCalledWith(workbox, logger);
  });

  it("starts tracking in-app navigation", () => {
    const { useTrackInAppNavigation } = setup();

    expect(useTrackInAppNavigation).toHaveBeenCalled();
  });

  it("renders nothing", () => {
    const { container } = setup();

    expect(container).toBeEmptyDOMElement();
  });

  function setup() {
    const migrateLocalStorage = vi.fn<typeof DEPENDENCIES.migrateLocalStorage>();
    const forgetRetiredStorage = vi.fn<typeof DEPENDENCIES.forgetRetiredStorage>();
    const registerServiceWorker = vi.fn<typeof DEPENDENCIES.registerServiceWorker>();
    const useTrackInAppNavigation = vi.fn<typeof DEPENDENCIES.useTrackInAppNavigation>();
    const workbox = mock<ServiceWorkerRegistrar>();
    const logger = mock<LoggerService>();
    window.workbox = workbox;

    const { container } = render(
      <TestContainerProvider services={{ logger: () => logger }}>
        <AppBootstrap dependencies={{ useTrackInAppNavigation, migrateLocalStorage, forgetRetiredStorage, registerServiceWorker }} />
      </TestContainerProvider>
    );

    return { container, migrateLocalStorage, forgetRetiredStorage, registerServiceWorker, useTrackInAppNavigation, workbox, logger };
  }
});
