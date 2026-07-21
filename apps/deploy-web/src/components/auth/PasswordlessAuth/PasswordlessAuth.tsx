"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";

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
  useRouter,
  useSearchParams,
  useUser
};

interface Props extends PassedFlowProps {
  dependencies?: typeof DEPENDENCIES;
}

export function PasswordlessAuth({ dependencies: d = DEPENDENCIES, ...props }: Props) {
  const { publicConfig, analyticsService } = useServices();
  const { navigateBack } = d.useReturnTo({ defaultReturnTo: "/" });
  const { checkSession } = d.useUser();
  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const isOnboardingRedesignEnabled = d.useFlag("onboarding_redesign_v1");
  const [email, setEmail] = useState(props.initialEmail);
  const [screenKey, setScreenKey] = useState(0);
  const turnstileRef = useRef<TurnstileRef>(null);

  const screen: "entry" | "verify" = searchParams.get("step") === "verify" ? "verify" : "entry";

  const { onEmailChange, onFlowReset } = props;

  const getCaptchaToken = useCallback(async () => {
    if (!turnstileRef.current) {
      throw new Error("Captcha has not been rendered");
    }
    const { token } = await turnstileRef.current.renderAndWaitResponse();
    return token;
  }, []);

  const goToVerify = useCallback(
    (verifiedEmail: string) => {
      setEmail(verifiedEmail);
      onEmailChange(verifiedEmail);
      const params = new URLSearchParams(searchParams);
      params.set("step", "verify");
      router.push(`?${params.toString()}`, undefined, { shallow: true });
    },
    [router, searchParams, onEmailChange]
  );

  const goBackToEntry = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("step");
    const query = params.toString();
    router.replace(query ? `?${query}` : router.pathname, undefined, { shallow: true });
  }, [router, searchParams]);

  useEffect(
    function redirectToEntryWhenEmailMissing() {
      if (screen === "verify" && !email) {
        goBackToEntry();
      }
    },
    [screen, email, goBackToEntry]
  );

  const handleVerified = useCallback(async () => {
    onFlowReset();
    await checkSession();
    navigateBack();
  }, [checkSession, navigateBack, onFlowReset]);

  const remountActiveScreen = useCallback(() => {
    setScreenKey(value => value + 1);
  }, []);

  return (
    <>
      <div className="flex w-full flex-col items-center gap-2 text-center">
        <h1 className="text-[30px] leading-9 text-neutral-950 dark:text-neutral-50">{screen === "verify" ? "Check your email" : "Start deploying"}</h1>
        {isOnboardingRedesignEnabled && screen === "entry" && (
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
          <div className="flex flex-col text-center text-xs leading-4 text-neutral-500 dark:text-neutral-400">
            <p>We&apos;ll email you a 6 digit code. No password to remember.</p>
            <p>
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
          </div>
        </>
      )}
      {screen === "verify" && email && (
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
