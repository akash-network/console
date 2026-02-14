import "@testing-library/jest-dom";
import "whatwg-fetch";

import { webcrypto } from "crypto";
import { mock } from "jest-mock-extended";
import { Blob } from "node:buffer";
import { TextDecoder, TextEncoder } from "util";

Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
  Blob,
  ResizeObserver: jest.fn().mockImplementation(() => mock<ResizeObserver>())
});

Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true
});

// Mock hasPointerCapture and scrollIntoView for jsdom compatibility with Radix UI
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  value: jest.fn().mockReturnValue(false),
  writable: true,
  configurable: true
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: jest.fn(),
  writable: true,
  configurable: true
});

document.queryCommandSupported ??= () => false;

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn()
    }))
  });
});
