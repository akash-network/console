"use client";

import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdInfo } from "react-icons/md";
import { Button } from "@akashnetwork/ui/components";
import { Turnstile as ReactTurnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import axios, { AxiosError, AxiosResponse } from "axios";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { firstValueFrom, Subject } from "rxjs";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useWhen } from "@src/hooks/useWhen";
import { services } from "@src/services/http/http-browser.service";
import { managedWalletHttpService } from "@src/services/managed-wallet-http/managed-wallet-http.service";

const HTTP_SERVICES = [managedWalletHttpService, services.user, services.stripe, services.tx, services.template, services.auth, services.deploymentSetting];

const originalFetch = typeof window !== "undefined" && window.fetch;

const addResponseInterceptor = (interceptor: (value: AxiosError) => AxiosResponse | Promise<AxiosResponse>) => {
  const removes = HTTP_SERVICES.map(service => {
    const interceptorId = service.interceptors.response.use(null, interceptor);

    return () => {
      service.interceptors.response.eject(interceptorId);
    };
  });

  return () => {
    removes.forEach(remove => remove());
  };
};

type TurnstileStatus = "uninitialized" | "solved" | "interactive" | "expired" | "error" | "dismissed";

const VISIBILITY_STATUSES: TurnstileStatus[] = ["interactive", "error"];

type TurnstileProps = {
  enabled?: boolean;
  siteKey?: string;
};

export const Turnstile: FC<TurnstileProps> = ({
  enabled = browserEnvConfig.NEXT_PUBLIC_TURNSTILE_ENABLED,
  siteKey = browserEnvConfig.NEXT_PUBLIC_TURNSTILE_SITE_KEY
}) => {
  const turnstileRef = useRef<TurnstileInstance>();
  const [status, setStatus] = useState<TurnstileStatus>("uninitialized");
  const isVisible = useMemo(() => enabled && VISIBILITY_STATUSES.includes(status), [enabled, status]);
  const dismissedSubject = useRef(new Subject<void>());

  useEffect(() => {
    if (!enabled) return;

    if (originalFetch) {
      window.fetch = async (...args) => {
        let response = await originalFetch(...args);

        if (typeof args[0] === "string" && args[0].startsWith("/") && response.status > 400 && turnstileRef.current) {
          turnstileRef.current?.remove();
          turnstileRef.current?.render();
          turnstileRef.current?.execute();

          const turnstileResponse = await Promise.race([turnstileRef.current.getResponsePromise(), firstValueFrom(dismissedSubject.current.asObservable())]);

          if (turnstileResponse) {
            response = await originalFetch(...args);
          }
        }

        return response;
      };
    }

    const ejectInterceptors = addResponseInterceptor(async error => {
      const request = error?.request;

      if ((!request?.status || request?.status > 400) && turnstileRef.current) {
        turnstileRef.current?.remove();
        turnstileRef.current?.render();
        turnstileRef.current?.execute();

        const response = await Promise.race([turnstileRef.current.getResponsePromise(), firstValueFrom(dismissedSubject.current.asObservable())]);

        if (response) {
          return axios(error.config!);
        }
      }

      return Promise.reject(error);
    });

    return () => {
      ejectInterceptors();
      if (originalFetch) {
        window.fetch = originalFetch;
      }
    };
  }, [enabled]);

  const resetWidget = useCallback(() => {
    turnstileRef.current?.remove();
    turnstileRef.current?.render();
    turnstileRef.current?.execute();
  }, []);

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
            <ReactTurnstile
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
              <Button onClick={resetWidget} className="mr-4">
                Retry
              </Button>
              <Button
                onClick={() => {
                  setStatus("dismissed");
                  dismissedSubject.current.next();
                  turnstileRef.current?.remove();
                }}
                variant="link"
              >
                Dismiss
              </Button>
            </div>

            <p>
              <MdInfo className="mr-1 inline text-xl text-muted-foreground" />
              <small>dismissing the check might result into some features not working properly</small>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
};

export const ClientOnlyTurnstile = dynamic(() => Promise.resolve(Turnstile), { ssr: false });
