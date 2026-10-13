import { useSyncExternalStore } from "react";

import type { KeyToken } from "./commandMenuCatalog";

const MAC_PLATFORMS = /Mac|iPhone|iPad/;

const LETTER = /^[a-z]$/i;

type MenuToggleKeyEvent = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

export function detectMac(source?: { platform?: string; userAgent?: string }): boolean {
  return MAC_PLATFORMS.test(source?.platform || source?.userAgent || "");
}

/** Undefined on the server and while hydrating, so server-rendered key labels match; known on the first render otherwise. */
export function useIsMac(): boolean | undefined {
  return useSyncExternalStore(subscribeToNothing, detectBrowserPlatform, readNothingOnTheServer);
}

function subscribeToNothing() {
  return function unsubscribe() {};
}

function detectBrowserPlatform() {
  return detectMac(navigator);
}

function readNothingOnTheServer() {
  return undefined;
}

export function isMenuToggleKey(event: MenuToggleKeyEvent, isMac: boolean): boolean {
  const isModifierHeld = isMac ? event.metaKey : event.ctrlKey;

  return isModifierHeld && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k";
}

/** Letters honour Shift but not caps lock; symbols ignore the Shift it takes to type them. */
export function isShortcutKey(event: Pick<KeyboardEvent, "key" | "shiftKey">, keys: KeyToken[]): boolean {
  const key = keys[keys.length - 1];

  if (LETTER.test(key) && event.shiftKey !== keys.includes("shift")) return false;

  return event.key.toLowerCase() === key.toLowerCase();
}
