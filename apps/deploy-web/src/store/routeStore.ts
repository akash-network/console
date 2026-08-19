import { atom } from "jotai";

/** How many in-app history entries sit behind the current one. 0 means the current page is where the SPA session started. */
const inAppHistoryDepth = atom(0);

export default {
  inAppHistoryDepth
};
