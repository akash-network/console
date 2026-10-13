import { useEffect, useState } from "react";

const MAC_PLATFORMS = /Mac|iPhone|iPad/;

type MenuToggleKeyEvent = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">;

export function detectMac(source?: { platform?: string; userAgent?: string }): boolean {
  return MAC_PLATFORMS.test(source?.platform || source?.userAgent || "");
}

/** Undefined until mounted, so the server render and the first client render agree on the key labels. */
export function useIsMac(): boolean | undefined {
  const [isMac, setIsMac] = useState<boolean>();

  useEffect(function detectPlatformOnceMounted() {
    setIsMac(detectMac(navigator));
  }, []);

  return isMac;
}

export function isMenuToggleKey(event: MenuToggleKeyEvent, isMac: boolean): boolean {
  const isModifierHeld = isMac ? event.metaKey : event.ctrlKey;

  return isModifierHeld && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k";
}
