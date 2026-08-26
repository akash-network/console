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

type TurnstileStatus = "uninitialized" | "solved" | "interactive" | "expired" | "error" | "dismissed";

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
  const { errorHandler } = useServices();

  const hasReportedFailure = useRef(false);
  /** Cloudflare keeps retrying every 8s, so only the first anomaly of a run is reported: enough to diagnose, without one Sentry event per retry per stuck visitor. A run ends at the next success or the next challenge the caller asks for. */
  const reportChallengeFailure = useCallback(
    (error: unknown, event: string) => {
      if (hasReportedFailure.current) return;
      hasReportedFailure.current = true;
      errorHandler.reportError({ error, severity: "warning", tags: { event } });
    },
    [errorHandler]
  );

  const resetWidget = useCallback(() => {
    turnstileRef.current?.remove();
    turnstileRef.current?.render();
    turnstileRef.current?.execute();
  }, []);
  const abandonPendingChallenge = useRef<(() => void) | undefined>(undefined);
  /** Notifies the parent before rejecting so it can drop the abandoned attempt instead of rendering it as a failure. */
  const hideWidget = useCallback(() => {
    setStatus("dismissed");
    onDismissed?.();
    abandonPendingChallenge.current?.();
  }, [onDismissed]);

  useWhen(status === "dismissed", () => {
    turnstileRef.current?.remove();
  });
  useEffect(function abandonPendingChallengeOnUnmount() {
    return () => abandonPendingChallenge.current?.();
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
        hasReportedFailure.current = false;
        resetWidget();
        return new Promise((resolve, reject) => {
          const stopWaiting = () => {
            clearTimeout(deadline);
            eventBus.current.removeEventListener("success", successListener);
            eventBus.current.removeEventListener("error", errorListener);
            abandonPendingChallenge.current = undefined;
          };
          const successListener = (event: Event) => {
            stopWaiting();
            resolve((event as CustomEvent<{ token: string }>).detail);
          };
          const errorListener = (event: Event) => {
            stopWaiting();
            const details = (event as CustomEvent<{ reason: string; error?: string }>).detail;
            reject({ status, ...details });
          };

          abandonPendingChallenge.current = () => {
            stopWaiting();
            reject({ reason: "dismissed" });
          };
          const deadline = setTimeout(() => {
            stopWaiting();
            reportChallengeFailure(new Error("Turnstile challenge never settled"), "TURNSTILE_CHALLENGE_WEDGED");
            reject({ reason: "timeout" });
          }, CHALLENGE_DEADLINE_MS);

          eventBus.current.addEventListener("success", successListener);
          eventBus.current.addEventListener("error", errorListener);
        });
      }
    }),
    [resetWidget, enabled, reportChallengeFailure]
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
                reportChallengeFailure(error, "TURNSTILE_CHALLENGE_FAILED");
                eventBus.current.dispatchEvent(new CustomEvent("error", { detail: { error, reason: "error" } }));
              }}
              onExpire={() => setStatus("expired")}
              onTimeout={() => reportChallengeFailure(new Error("Turnstile challenge timed out"), "TURNSTILE_CHALLENGE_TIMED_OUT")}
              onSuccess={token => {
                setStatus("solved");
                hasReportedFailure.current = false;
                eventBus.current.dispatchEvent(new CustomEvent("success", { detail: { token } }));
              }}
              onBeforeInteractive={() => setStatus("interactive")}
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
