import "@testing-library/jest-dom/vitest";

import { Blob } from "node:buffer";
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

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});
