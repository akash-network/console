"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import type { TurnstileRef } from "@src/components/turnstile/Turnstile";
import { ClientOnlyTurnstile } from "@src/components/turnstile/Turnstile";
import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useReturnTo } from "@src/hooks/useReturnTo/useReturnTo";
import { useUser } from "@src/hooks/useUser";
import { EmailCodeStart } from "../EmailCodeStart/EmailCodeStart";
import { EmailCodeVerify } from "../EmailCodeVerify/EmailCodeVerify";
import { OAuthRow } from "../OAuthRow/OAuthRow";
import type { PassedFlowProps } from "./withPersistedPasswordlessFlow";
import { withPersistedPasswordlessFlow } from "./withPersistedPasswordlessFlow";

export const DEPENDENCIES = {
  EmailCodeStart,
  EmailCodeVerify,
  Link,
  OAuthRow,
  Turnstile: ClientOnlyTurnstile,
  useFlag,
  useReturnTo,
  useUser
};

interface Props extends PassedFlowProps {
  dependencies?: typeof DEPENDENCIES;
}

export function PasswordlessAuth({ dependencies: d = DEPENDENCIES, ...props }: Props) {
  const { publicConfig, analyticsService } = useServices();
  const { navigateBack } = d.useReturnTo({ defaultReturnTo: "/" });
  const { checkSession } = d.useUser();
  const isOnboardingRedesignEnabled = d.useFlag("onboarding_redesign_v1");
  const [email, setEmail] = useState(props.initialEmail);
  const [screen, setScreen] = useState<"entry" | "verify">(props.initialScreen);
  const [screenKey, setScreenKey] = useState(0);
  const turnstileRef = useRef<TurnstileRef>(null);

  const getCaptchaToken = useCallback(async function getCaptchaToken() {
    if (!turnstileRef.current) {
      throw new Error("Captcha has not been rendered");
    }
    const { token } = await turnstileRef.current.renderAndWaitResponse();
    return token;
  }, []);

  const goToVerify = useCallback(function goToVerify(verifiedEmail: string) {
    setEmail(verifiedEmail);
    setScreen("verify");
  }, []);

  const goBackToEntry = useCallback(function goBackToEntry() {
    setScreen("entry");
  }, []);

  const { onFlowChange, onFlowReset } = props;

  const handleVerified = useCallback(
    async function handleVerified() {
      onFlowReset();
      await checkSession();
      navigateBack();
    },
    [checkSession, navigateBack, onFlowReset]
  );

  const remountActiveScreen = useCallback(function remountActiveScreen() {
    setScreenKey(value => value + 1);
  }, []);

  const isFirstFlowChangeRef = useRef(true);
  useEffect(
    function notifyFlowChange() {
      if (isFirstFlowChangeRef.current) {
        isFirstFlowChangeRef.current = false;
        return;
      }
      onFlowChange({ email, screen });
    },
    [email, screen, onFlowChange]
  );

  return (
    <>
      <div className="flex w-full flex-col items-center gap-2 text-center">
        <h1 className="text-[30px] leading-9 text-neutral-950 dark:text-neutral-50">Start deploying</h1>
        {isOnboardingRedesignEnabled && (
          <p className="text-sm leading-5 text-neutral-500 dark:text-neutral-400">$1 credit to deploy your first container. No card required.</p>
        )}
      </div>
      {screen === "entry" && (
        <>
          <d.OAuthRow />
          <div className="flex w-full items-center gap-3">
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">OR</span>
            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
          </div>
          <d.EmailCodeStart key={`start-${screenKey}`} defaultEmail={email} getCaptchaToken={getCaptchaToken} onStarted={goToVerify} />
          <p className="text-center text-xs leading-4 text-neutral-500 dark:text-neutral-400">
            By continuing, you agree to our{" "}
            <d.Link
              href="/terms-of-service"
              prefetch={false}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => analyticsService.track("terms_link_clk")}
              className="font-medium text-neutral-950 underline dark:text-neutral-50"
            >
              Terms
            </d.Link>{" "}
            and{" "}
            <d.Link
              href="/privacy-policy"
              prefetch={false}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => analyticsService.track("privacy_policy_link_clk")}
              className="font-medium text-neutral-950 underline dark:text-neutral-50"
            >
              Privacy Policy
            </d.Link>
            .
          </p>
        </>
      )}
      {screen === "verify" && (
        <d.EmailCodeVerify
          key={`verify-${screenKey}`}
          email={email}
          getCaptchaToken={getCaptchaToken}
          onEditEmail={goBackToEntry}
          onVerified={handleVerified}
        />
      )}
      <d.Turnstile
        turnstileRef={turnstileRef}
        enabled={publicConfig.NEXT_PUBLIC_TURNSTILE_ENABLED}
        siteKey={publicConfig.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        onDismissed={remountActiveScreen}
      />
    </>
  );
}

const PersistedPasswordlessAuth = withPersistedPasswordlessFlow(PasswordlessAuth);

/**
 * Route-facing entry: wraps the orchestrator with sessionStorage persistence and skips SSR.
 * Skipping SSR avoids the hydration mismatch that would otherwise produce a "wrong screen" flash on reload —
 * the lazy useState initializer inside the HoC reads sessionStorage during the first (client-only) render.
 */
export const PasswordlessAuthClient = dynamic(() => Promise.resolve(PersistedPasswordlessAuth), {
  ssr: false,
  loading: () => null
});
