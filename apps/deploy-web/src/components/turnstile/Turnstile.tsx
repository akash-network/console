"use client";

import { FC, useEffect, useMemo, useRef, useState } from "react";
import { MdInfo } from "react-icons/md";
import { Button } from "@akashnetwork/ui/components";
import { Turnstile as ReactTurnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import classnames from "classnames";

import { browserEnvConfig } from "@src/config/browser-env.config";

type TurnstileStatus = "uninitialized" | "solved" | "interactive" | "expired" | "error" | "dismissed";

const VISIBILITY_STATUSES: TurnstileStatus[] = ["uninitialized", "interactive", "error"];

export const Turnstile: FC = () => {
  const turnstileRef = useRef<TurnstileInstance>();
  const [status, setStatus] = useState<TurnstileStatus>("uninitialized");
  const [isTimingOut, setIsTimingOut] = useState(false);
  const isVisible = useMemo(() => !!browserEnvConfig.NEXT_PUBLIC_TURNSTILE_ENABLED && VISIBILITY_STATUSES.includes(status), [status]);
  const hasActions = useMemo(() => isTimingOut || status === "error", [isTimingOut, status]);

  useEffect(() => {
    if (isVisible) {
      const timeout = setTimeout(() => {
        setIsTimingOut(true);
      }, 5000);

      return () => clearTimeout(timeout);
    }
  }, [isVisible]);

  return browserEnvConfig.NEXT_PUBLIC_TURNSTILE_ENABLED ? (
    <>
      <div className={classnames({ hidden: !isVisible }, "fixed inset-0 z-[101] flex content-center items-center justify-center bg-white bg-opacity-90")}>
        <div className="flex flex-col items-center">
          <h3 className="mb-2 text-2xl font-bold">We are verifying you are a human. This may take a few seconds</h3>
          <p className="mb-8">Reviewing the security of your connection before proceeding</p>
          <div className="h-[66px]">
            <ReactTurnstile
              ref={turnstileRef}
              siteKey={browserEnvConfig.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              onError={() => setStatus("error")}
              onExpire={() => setStatus("expired")}
              onSuccess={() => setStatus("solved")}
              onBeforeInteractive={() => setStatus("interactive")}
            />
          </div>
          {status === "error" && <p className="text-red-600">Some error occurred</p>}
          <div
            className={classnames(
              {
                "invisible opacity-0": !hasActions,
                "visible opacity-100": hasActions
              },
              "flex flex-col items-center transition-opacity duration-200"
            )}
          >
            <div className="my-8">
              <Button onClick={turnstileRef.current?.reset} className="mr-4">
                Retry
              </Button>
              <Button onClick={() => setStatus("dismissed")} variant="link">
                Dismiss
              </Button>
            </div>

            <p>
              <MdInfo className="mr-1 inline text-xl text-muted-foreground" />
              <small>dismissing the check might result into some features not working properly</small>
            </p>
          </div>
        </div>
      </div>
    </>
  ) : null;
};
