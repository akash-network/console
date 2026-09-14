"use client";

import type { RefObject } from "react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { MdInfo } from "react-icons/md";
import { Button } from "@akashnetwork/ui/components";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { Turnstile as ReactTurnstile } from "@marsidev/react-turnstile";
import { motion } from "framer-motion";
import { RefreshCwIcon, Undo2 } from "lucide-react";
import dynamic from "next/dynamic";

import { useServices } from "@src/context/ServicesProvider";
import { useWhen } from "@src/hooks/useWhen";
import { getInjectedConfig } from "@src/utils/getInjectedConfig/getInjectedConfig";
import { CaptchaChallengeError } from "./CaptchaChallengeError";

type TurnstileStatus = "uninitialized" | "solved" | "interactive" | "expired" | "error" | "dismissed" | "timedout";

const VISIBILITY_STATUSES: TurnstileStatus[] = ["interactive", "error"];

/**
 * Cloudflare recovers from a failed or expired challenge on its own, so the widget must never be torn down and
 * rebuilt from our side: doing so restarts the challenge with no backoff, and an error -> interactive -> error
 * cycle then flaps forever until the page is hard reloaded.
 */
const RECOVERY_OPTIONS = { retry: "auto", retryInterval: 8_000, refreshExpired: "auto" } as const;

/** Bounds how long a caller waits on those retries, so a wedged challenge surfaces an error instead of hanging the form. */
export const CHALLENGE_DEADLINE_MS = 120_000;

export const COMPONENTS = {
  ReactTurnstile,
  Button,
  MdInfo
};

export type TurnstileRef = {
  renderAndWaitResponse: () => Promise<{ token: string }>;
  abandonPendingChallenge: () => void;
};

type TurnstileProps = {
  enabled: boolean;
  siteKey: string;
  onDismissed?: () => void;
  turnstileRef?: RefObject<TurnstileRef>;
  components?: typeof COMPONENTS;
};

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(function Turnstile(
  { enabled, siteKey, onDismissed, turnstileRef: externalTurnstileRef, components: c = COMPONENTS },
  ref
) {
  const turnstileRef = useRef<TurnstileInstance>();
  const [status, setStatus] = useState<TurnstileStatus>("uninitialized");
  const isVisible = useMemo(() => enabled && VISIBILITY_STATUSES.includes(status), [enabled, status]);
  const eventBus = useRef<EventTarget>(new EventTarget());
  const injectedConfig = getInjectedConfig();
  const { errorHandler, analyticsService } = useServices();

  /** Cloudflare keeps retrying every 8s and its own timeouts land after ours, so a run reports at most one anomaly and stops reporting altogether once it has been settled. */
  const hasSettledRun = useRef(false);
  const reportChallengeFailure = useCallback(
    (error: unknown, event: string) => {
      if (hasSettledRun.current) return;
      hasSettledRun.current = true;
      errorHandler.reportError({ error, severity: "warning", tags: { event } });
    },
    [errorHandler]
  );

  /** Cloudflare stops calling back once a challenge turns interactive and waits on the visitor, so a deadline reached in that state is an abandoned challenge rather than a wedged one. */
  const isAwaitingInteraction = useRef(false);

  const resetWidget = useCallback(() => {
    turnstileRef.current?.remove();
    turnstileRef.current?.render();
    turnstileRef.current?.execute();
  }, []);
  const isWidgetLoaded = useRef(false);
  const startChallengeOnWidgetLoad = useRef<(() => void) | undefined>(undefined);
  /** Cloudflare's api.js can still be in flight when the visitor submits, and it silently drops render and execute calls made before it lands, leaving a challenge that never starts. */
  const startChallenge = useCallback(() => {
    if (isWidgetLoaded.current) {
      resetWidget();
      return;
    }

    startChallengeOnWidgetLoad.current = resetWidget;
  }, [resetWidget]);
  const abandonPendingChallenge = useRef<(() => void) | undefined>(undefined);
  const stopWaitingForChallenge = useRef<(() => void) | undefined>(undefined);
  /** Notifies the parent before rejecting so it can drop the abandoned attempt instead of rendering it as a failure. */
  const hideWidget = useCallback(() => {
    setStatus("dismissed");
    onDismissed?.();
    abandonPendingChallenge.current?.();
  }, [onDismissed]);

  useWhen(status === "dismissed", () => {
    turnstileRef.current?.remove();
  });
  /**
   * Unmounting is not a dismissal, so the deadline is dropped without settling the promise: the caller awaiting it is
   * going away with us. Rejecting instead would surface as a mutation error and reach the global MutationCache
   * reporter as an untagged non-Error, one Sentry event for every visitor who navigates off mid-challenge.
   */
  useEffect(function stopWaitingForChallengeOnUnmount() {
    return () => stopWaitingForChallenge.current?.();
  }, []);

  useImperativeHandle(
    ref || externalTurnstileRef,
    () => ({
      abandonPendingChallenge() {
        abandonPendingChallenge.current?.();
      },
      renderAndWaitResponse() {
        if (!enabled) {
          return Promise.resolve({ token: "disabled-turnstile-token" });
        }

        abandonPendingChallenge.current?.();
        hasSettledRun.current = false;
        isAwaitingInteraction.current = false;
        startChallenge();
        return new Promise((resolve, reject) => {
          const stopWaiting = () => {
            clearTimeout(deadline);
            startChallengeOnWidgetLoad.current = undefined;
            eventBus.current.removeEventListener("success", successListener);
            eventBus.current.removeEventListener("error", errorListener);
            abandonPendingChallenge.current = undefined;
            stopWaitingForChallenge.current = undefined;
          };
          const successListener = (event: Event) => {
            stopWaiting();
            resolve((event as CustomEvent<{ token: string }>).detail);
          };
          const errorListener = (event: Event) => {
            stopWaiting();
            const { code } = (event as CustomEvent<{ code?: string }>).detail;
            reject(new CaptchaChallengeError("error", code));
          };

          abandonPendingChallenge.current = () => {
            stopWaiting();
            reject(new CaptchaChallengeError("dismissed"));
          };
          stopWaitingForChallenge.current = stopWaiting;
          const deadline = setTimeout(() => {
            stopWaiting();
            setStatus("timedout");

            if (isAwaitingInteraction.current) {
              hasSettledRun.current = true;
              analyticsService.track("captcha_abandoned", "GA");
              reject(new CaptchaChallengeError("abandoned"));
              return;
            }

            reportChallengeFailure(new Error("Turnstile challenge never settled"), "TURNSTILE_CHALLENGE_WEDGED");
            reject(new CaptchaChallengeError("timeout"));
          }, CHALLENGE_DEADLINE_MS);

          eventBus.current.addEventListener("success", successListener);
          eventBus.current.addEventListener("error", errorListener);
        });
      }
    }),
    [startChallenge, enabled, reportChallengeFailure, analyticsService]
  );

  if (!enabled) {
    return null;
  }

  return (
    <>
      <motion.div
        className="absolute inset-0 z-[101] flex content-center items-center justify-center bg-[hsl(var(--background))]"
        initial={{ opacity: 0 }}
        animate={{ opacity: isVisible ? 1 : 0 }}
        style={{ pointerEvents: isVisible ? "auto" : "none" }}
        transition={{
          duration: 0.3,
          delay: isVisible ? 0 : status === "dismissed" ? 0 : 1
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <p className="font-bold">We are verifying you are a human. This may take a moment</p>
            <p className="text-sm text-muted-foreground">Reviewing the security of your connection before proceeding</p>
          </div>
          <div className="flex h-[66px] items-center">
            <c.ReactTurnstile
              className="flex-1"
              ref={turnstileRef}
              siteKey={injectedConfig?.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? siteKey}
              options={{ execution: "execute", size: "normal", ...RECOVERY_OPTIONS }}
              onError={error => {
                setStatus("error");
                reportChallengeFailure(new Error(`Turnstile challenge failed with code ${error}`), "TURNSTILE_CHALLENGE_FAILED");
                eventBus.current.dispatchEvent(new CustomEvent("error", { detail: { code: error } }));
              }}
              onExpire={() => setStatus("expired")}
              onTimeout={() => reportChallengeFailure(new Error("Turnstile challenge timed out"), "TURNSTILE_CHALLENGE_TIMED_OUT")}
              onSuccess={token => {
                setStatus("solved");
                hasSettledRun.current = false;
                isAwaitingInteraction.current = false;
                eventBus.current.dispatchEvent(new CustomEvent("success", { detail: { token } }));
              }}
              onBeforeInteractive={() => {
                isAwaitingInteraction.current = true;
                setStatus("interactive");
              }}
              onAfterInteractive={() => {
                isAwaitingInteraction.current = false;
              }}
              onWidgetLoad={() => {
                isWidgetLoaded.current = true;
                const startPendingChallenge = startChallengeOnWidgetLoad.current;
                startChallengeOnWidgetLoad.current = undefined;
                startPendingChallenge?.();
              }}
            />
            <motion.div
              className="flex flex-col items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: isVisible ? 1 : 0 }}
              style={{ pointerEvents: isVisible ? "auto" : "none" }}
              transition={{
                duration: 0.3,
                delay: isVisible ? (status === "error" ? 0 : 5) : 1
              }}
            >
              <div className="ml-2 inline-flex gap-2">
                <c.Button onClick={resetWidget} size="icon" variant="outline" aria-label="Reload captcha">
                  <RefreshCwIcon className="size-4" />
                </c.Button>
                <c.Button onClick={hideWidget} size="icon" variant="outline" aria-label="Dismiss captcha">
                  <Undo2 className="size-4" />
                </c.Button>
              </div>
            </motion.div>
          </div>
          {status === "error" && <p className="text-red-600">Some error occurred</p>}
        </div>
      </motion.div>
    </>
  );
});

export const ClientOnlyTurnstile = dynamic(async () => Turnstile, { ssr: false });
