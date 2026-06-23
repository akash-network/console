import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";

import { cleanup } from "@testing-library/react";

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

afterEach(() => {
  cleanup();
});
