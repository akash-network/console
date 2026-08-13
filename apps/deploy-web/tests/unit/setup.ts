import "@testing-library/jest-dom/vitest";

import { Blob } from "node:buffer";
import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, vi } from "vitest";

import { cleanup } from "@testing-library/react";

Object.assign(globalThis, {
  Blob,
  ResizeObserver: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
});

// jsdom 20 ships crypto.getRandomValues but not crypto.randomUUID
if (typeof globalThis.crypto.randomUUID !== "function") {
  Object.defineProperty(globalThis.crypto, "randomUUID", { value: randomUUID, writable: true, configurable: true });
}

// Mock hasPointerCapture and scrollIntoView for jsdom compatibility with Radix UI
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  value: () => false,
  writable: true,
  configurable: true
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: () => {},
  writable: true,
  configurable: true
});

document.queryCommandSupported ??= () => false;

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
});

/**
 * Unit tests share a single jsdom window (`isolate: false` in vitest.config.ts), so a spec that navigates
 * (e.g. history.replaceState) leaks its URL into every spec that runs after it in the same worker.
 */
function restoreInitialLocation() {
  window.history.replaceState(null, "", "/");
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  restoreInitialLocation();
});
