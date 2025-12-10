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
