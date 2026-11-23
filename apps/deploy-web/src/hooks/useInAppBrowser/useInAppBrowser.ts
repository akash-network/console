import { useSyncExternalStore } from "react";

import { detectInAppBrowser } from "@src/lib/in-app-browser/detectInAppBrowser";

const subscribeToUnchangingUserAgent = () => () => {};

const readInAppBrowser = () => detectInAppBrowser(navigator.userAgent);

const readInAppBrowserOnServer = () => undefined;

export function useInAppBrowser() {
  return useSyncExternalStore(subscribeToUnchangingUserAgent, readInAppBrowser, readInAppBrowserOnServer);
}
