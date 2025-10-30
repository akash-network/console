import "@testing-library/jest-dom";
import "whatwg-fetch";

import { Blob as BlobPolyfill } from "node:buffer";
import { TextDecoder, TextEncoder } from "util";

global.Blob = BlobPolyfill as unknown as typeof Blob;
Object.assign(global, { TextDecoder, TextEncoder });

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
