import { vi } from "vitest";

// temporary compat layer to reduce changes
/** @deprecated Use Vitest APIs directly instead of Jest */
globalThis.jest = vi as any;
