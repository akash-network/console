"use client";

import type { FC } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdInfo } from "react-icons/md";
import { Button } from "@akashnetwork/ui/components";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { Turnstile as ReactTurnstile } from "@marsidev/react-turnstile";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

import { useWhen } from "@src/hooks/useWhen";

let originalFetch: typeof fetch | undefined;

type TurnstileStatus = "uninitialized" | "solved" | "interactive" | "expired" | "error" | "dismissed";

const VISIBILITY_STATUSES: TurnstileStatus[] = ["interactive", "error"];

export const COMPONENTS = {
  ReactTurnstile,
  Button,
  MdInfo
};

type TurnstileProps = {
  enabled: boolean;
  siteKey: string;
  components?: typeof COMPONENTS;
};

export const Turnstile: FC<TurnstileProps> = ({ enabled, siteKey, components: c = COMPONENTS }) => {
  const turnstileRef = useRef<TurnstileInstance>();
  const [status, setStatus] = useState<TurnstileStatus>("uninitialized");
  const isVisible = useMemo(() => enabled && VISIBILITY_STATUSES.includes(status), [enabled, status]);
  const abortControllerRef = useRef<AbortController>();

  const resetWidget = useCallback(() => {
    turnstileRef.current?.remove();
    turnstileRef.current?.render();
    turnstileRef.current?.execute();
  }, []);

  const renderTurnstileAndWaitForResponse = useCallback(async () => {
    abortControllerRef.current = new AbortController();
    resetWidget();

    return Promise.race([
      turnstileRef.current?.getResponsePromise(),
      new Promise<void>(resolve => abortControllerRef.current?.signal.addEventListener("abort", () => resolve()))
    ]);
  }, [resetWidget]);

  useEffect(() => {
    if (!enabled) {
      if (typeof originalFetch === "function") {
        globalThis.fetch = originalFetch;
        originalFetch = undefined;
      }
      return;
    }

    if (typeof globalThis.fetch === "function") {
      originalFetch = originalFetch || globalThis.fetch;
      const fetch = originalFetch;
      globalThis.fetch = async (resource, options) => {
        const response = await fetch(resource, options);

        if (response.headers.get("cf-mitigated") === "challenge" && turnstileRef.current && (await renderTurnstileAndWaitForResponse())) {
          return globalThis.fetch(resource, options);
        }

        return response;
      };
    }

    return () => {
      if (typeof originalFetch === "function") {
        globalThis.fetch = originalFetch;
        originalFetch = undefined;
      }
    };
  }, [enabled]);

  useWhen(status === "error", () => {
    resetWidget();
  });

  if (!enabled) {
    return null;
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[101] flex content-center items-center justify-center bg-popover/90"
        initial={{ opacity: 0 }}
        animate={{ opacity: isVisible ? 1 : 0 }}
        style={{ pointerEvents: isVisible ? "auto" : "none" }}
        transition={{
          duration: 0.3,
          delay: isVisible ? 0 : status === "dismissed" ? 0 : 1
        }}
      >
        <div className="flex flex-col items-center">
          <h3 className="mb-2 text-2xl font-bold">We are verifying you are a human. This may take a few seconds</h3>
          <p className="mb-8">Reviewing the security of your connection before proceeding</p>
          <div className="h-[66px]">
            <c.ReactTurnstile
              ref={turnstileRef}
              siteKey={siteKey}
              options={{ execution: "execute" }}
              onError={() => setStatus("error")}
              onExpire={() => setStatus("expired")}
              onSuccess={() => setStatus("solved")}
              onBeforeInteractive={() => setStatus("interactive")}
            />
          </div>
          {status === "error" && <p className="text-red-600">Some error occurred</p>}
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
            <div className="my-8">
              <c.Button onClick={resetWidget} className="mr-4">
                Retry
              </c.Button>
              <c.Button
                onClick={() => {
                  setStatus("dismissed");
                  abortControllerRef.current?.abort();
                  turnstileRef.current?.remove();
                }}
                variant="link"
              >
                Dismiss
              </c.Button>
            </div>

            <p>
              <c.MdInfo className="mr-1 inline text-xl text-muted-foreground" />
              <small>dismissing the check might result into some features not working properly</small>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
};

export const ClientOnlyTurnstile = dynamic(() => Promise.resolve(Turnstile), { ssr: false });
