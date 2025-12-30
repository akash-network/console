"use client";

import type { RefObject } from "react";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { MdInfo } from "react-icons/md";
import { Button } from "@akashnetwork/ui/components";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { Turnstile as ReactTurnstile } from "@marsidev/react-turnstile";
import { motion } from "framer-motion";
import { RefreshCwIcon, Undo2 } from "lucide-react";
import dynamic from "next/dynamic";

import { useWhen } from "@src/hooks/useWhen";
import { getInjectedConfig } from "@src/utils/getInjectedConfig/getInjectedConfig";

type TurnstileStatus = "uninitialized" | "solved" | "interactive" | "expired" | "error" | "dismissed";

const VISIBILITY_STATUSES: TurnstileStatus[] = ["interactive", "error"];

export const COMPONENTS = {
  ReactTurnstile,
  Button,
  MdInfo
};

export type TurnstileRef = {
  renderAndWaitResponse: () => Promise<{ token: string }>;
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

  const resetWidget = useCallback(() => {
    turnstileRef.current?.remove();
    turnstileRef.current?.render();
    turnstileRef.current?.execute();
  }, []);
  const hideWidget = useCallback(() => {
    setStatus("dismissed");
    onDismissed?.();
  }, [onDismissed]);

  useWhen(status === "error" || status === "expired", () => {
    resetWidget();
  });
  useWhen(status === "dismissed", () => {
    turnstileRef.current?.remove();
  });

  useImperativeHandle(
    ref || externalTurnstileRef,
    () => ({
      renderAndWaitResponse() {
        if (!enabled) {
          return Promise.resolve({ token: "disabled-turnstile-token" });
        }

        resetWidget();
        return new Promise((resolve, reject) => {
          const successListener = (event: Event) => {
            eventBus.current.removeEventListener("success", successListener);
            eventBus.current.removeEventListener("error", errorListener);
            resolve((event as CustomEvent<{ token: string }>).detail);
          };
          const errorListener = (event: Event) => {
            eventBus.current.removeEventListener("success", successListener);
            eventBus.current.removeEventListener("error", errorListener);
            const details = (event as CustomEvent<{ reason: string; error?: string }>).detail;
            reject({ status, ...details });
          };

          eventBus.current.addEventListener("success", successListener);
          eventBus.current.addEventListener("error", errorListener);
        });
      }
    }),
    [resetWidget, enabled]
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
              options={{ execution: "execute" }}
              onError={error => {
                setStatus("error");
                eventBus.current.dispatchEvent(new CustomEvent("error", { detail: { error, reason: "error" } }));
              }}
              onExpire={() => {
                setStatus("expired");
                eventBus.current.dispatchEvent(new CustomEvent("expired", { detail: { reason: "expired" } }));
              }}
              onSuccess={token => {
                setStatus("solved");
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
