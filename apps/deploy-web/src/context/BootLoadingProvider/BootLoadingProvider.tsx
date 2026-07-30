import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { cn } from "@akashnetwork/ui/utils";

import { AkashLoadingMark } from "@src/components/layout/AkashLoadingMark";

/**
 * Keeps the single boot overlay mounted across the brief handoff when one gate resolves and the next
 * starts loading, so the mark never unmounts and re-pulses. Long enough to bridge an async gap between
 * gates, short enough to be imperceptible once the whole boot finishes.
 */
export const BOOT_LOADING_GRACE_MS = 150;

/** How long the background curtain fades out once boot finishes. */
export const BOOT_LOADING_FADE_MS = 500;

type BootLoadingContextValue = {
  begin: () => void;
  end: () => void;
};

const BootLoadingContext = createContext<BootLoadingContextValue>({
  begin: () => {},
  end: () => {}
});

type Props = {
  children: ReactNode;
};

export function BootLoadingProvider({ children }: Props) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isBooting, setIsBooting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const begin = useCallback(() => setPendingCount(count => count + 1), []);
  const end = useCallback(() => setPendingCount(count => Math.max(0, count - 1)), []);

  useEffect(() => {
    if (pendingCount > 0) {
      setIsBooting(true);
      setIsMounted(true);
      return;
    }

    const graceTimer = setTimeout(() => setIsBooting(false), BOOT_LOADING_GRACE_MS);
    const unmountTimer = setTimeout(() => setIsMounted(false), BOOT_LOADING_GRACE_MS + BOOT_LOADING_FADE_MS);
    return () => {
      clearTimeout(graceTimer);
      clearTimeout(unmountTimer);
    };
  }, [pendingCount]);

  return (
    <BootLoadingContext.Provider value={{ begin, end }}>
      {children}
      {isMounted && (
        <div
          data-testid="app-boot-loading"
          style={{ transitionDuration: `${BOOT_LOADING_FADE_MS}ms` }}
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity motion-reduce:transition-none",
            isBooting ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        >
          {isBooting && <AkashLoadingMark />}
        </div>
      )}
    </BootLoadingContext.Provider>
  );
}

/**
 * Rendered by a boot gate while it is still resolving. It registers as pending for its whole lifetime
 * and renders nothing itself, letting the provider's single overlay cover the viewport.
 */
export function BootLoading() {
  const { begin, end } = useContext(BootLoadingContext);

  useEffect(() => {
    begin();
    return end;
  }, [begin, end]);

  return null;
}
