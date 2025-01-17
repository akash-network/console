"use client";

import { FC, useEffect, useMemo, useRef, useState } from "react";
import { MdInfo } from "react-icons/md";
import { Button } from "@akashnetwork/ui/components";
import { Turnstile as ReactTurnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import classnames from "classnames";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useWhen } from "@src/hooks/useWhen";

type TurnstileStatus = "uninitialized" | "solved" | "interactive" | "expired" | "error" | "dismissed" | "retrying";

const VISIBILITY_STATUSES: TurnstileStatus[] = ["interactive", "error", "retrying"];

export const Turnstile: FC = () => {
  const turnstileRef = useRef<TurnstileInstance>();
  const [status, setStatus] = useState<TurnstileStatus>("uninitialized");
  const [isTimingOut, setIsTimingOut] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [shouldHide, setShouldHide] = useState(true);
  const hasActions = useMemo(() => isTimingOut || status === "error", [isTimingOut, status]);

  useEffect(() => {
    if (!browserEnvConfig.NEXT_PUBLIC_TURNSTILE_ENABLED) {
      setIsVisible(false);
    } else if (VISIBILITY_STATUSES.includes(status)) {
      setIsVisible(true);
      setShouldHide(false);
    } else if (isVisible && status === "dismissed") {
      setShouldHide(true);
    } else if (isVisible) {
      setTimeout(() => setShouldHide(true), 1000);
    }
  }, [isVisible, status]);

  useWhen(isVisible, () => {
    setTimeout(() => setIsTimingOut(true), 5000);
  });

  useWhen(shouldHide, () => {
    setTimeout(() => setIsVisible(false), 400);
  });

  return browserEnvConfig.NEXT_PUBLIC_TURNSTILE_ENABLED ? (
    <>
      <div
        className={classnames(
          {
            "opacity-0": shouldHide,
            "opacity-100": !shouldHide,
            visible: isVisible,
            invisible: !isVisible
          },
          "fixed inset-0 z-[101] flex content-center items-center justify-center bg-white bg-opacity-90 transition-opacity duration-300"
        )}
      >
        <div className="flex flex-col items-center">
          <h3 className="mb-2 text-2xl font-bold">We are verifying you are a human. This may take a few seconds</h3>
          <p className="mb-8">Reviewing the security of your connection before proceeding</p>
          <div className="h-[66px]">
            <ReactTurnstile
              ref={turnstileRef}
              siteKey={browserEnvConfig.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              onError={() =>
                setStatus(prevStatus => {
                  if (prevStatus === "retrying") {
                    return "error";
                  }

                  turnstileRef.current?.reset();

                  return "retrying";
                })
              }
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
