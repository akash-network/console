import { createContext } from "react";

import { services as rootContainer } from "@src/services/http/http-browser.service";

export type RootContainer = typeof rootContainer;

/** @private */
export const ServicesContext = createContext<RootContainer>(rootContainer);
