import { createContext } from "react";

import type { services as rootContainer } from "@src/services/http/http-browser.service";

export type RootContainer = typeof rootContainer;

/** @private */
export const ServicesContext = createContext<RootContainer>(
  new Proxy(
    {},
    {
      get: (_, prop) => {
        throw new Error(`Service ${String(prop)} is not available in NoopContainer. Make sure to wrap your component with ServicesProvider.`);
      }
    }
  ) as RootContainer
);
