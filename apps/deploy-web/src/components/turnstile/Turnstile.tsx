"use client";

import { FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdInfo } from "react-icons/md";
import { Button } from "@akashnetwork/ui/components";
import { Turnstile as ReactTurnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import axios, { AxiosError, AxiosResponse } from "axios";
import { motion } from "framer-motion";
import { firstValueFrom, Subject } from "rxjs";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useWhen } from "@src/hooks/useWhen";
import { services } from "@src/services/http/http-browser.service";
import { managedWalletHttpService } from "@src/services/managed-wallet-http/managed-wallet-http.service";

const HTTP_SERVICES = [managedWalletHttpService, services.user, services.stripe, services.tx, services.template, services.auth, services.deploymentSetting];

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

export const Turnstile: FC = () => {
  const turnstileRef = useRef<TurnstileInstance>();
  const [status, setStatus] = useState<TurnstileStatus>("uninitialized");
  const isVisible = useMemo(() => !!browserEnvConfig.NEXT_PUBLIC_TURNSTILE_ENABLED && VISIBILITY_STATUSES.includes(status), [status]);
  const dismissedSubject = useRef(new Subject<void>());

  useEffect(() => {
    return addResponseInterceptor(async error => {
      const request = error?.request;

      if ((!request?.status || request?.status > 400) && turnstileRef.current) {
        turnstileRef.current?.render();
        turnstileRef.current?.execute();

        const response = await Promise.race([turnstileRef.current.getResponsePromise(), firstValueFrom(dismissedSubject.current.asObservable())]);

        if (response) {
          return axios(error.config!);
        }
      }

      return Promise.reject(error);
    });
  }, []);

  const resetWidget = useCallback(() => {
    turnstileRef.current?.remove();
    turnstileRef.current?.render();
    turnstileRef.current?.execute();
  }, []);

  useWhen(status === "error", () => {
    resetWidget();
  });

  return browserEnvConfig.NEXT_PUBLIC_TURNSTILE_ENABLED ? (
    <>
      <motion.div
        className="fixed inset-0 z-[101] flex content-center items-center justify-center bg-white bg-opacity-90"
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
              siteKey={browserEnvConfig.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
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
  ) : null;
};
