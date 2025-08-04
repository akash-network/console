import { createContext } from "react";

import { services as rootContainer } from "@src/services/app-di-container/browser-di-container";

export type RootContainer = typeof rootContainer;

/** @private */
export const ServicesContext = createContext<RootContainer>(rootContainer);
