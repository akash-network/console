"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";

import type { TurnstileRef } from "@src/components/turnstile/Turnstile";
import { ClientOnlyTurnstile } from "@src/components/turnstile/Turnstile";
import { BootLoading } from "@src/context/BootLoadingProvider/BootLoadingProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useReturnTo } from "@src/hooks/useReturnTo/useReturnTo";
import { useUser } from "@src/hooks/useUser";
import { EmailCodeStart } from "../EmailCodeStart/EmailCodeStart";
import { EmailCodeVerify } from "../EmailCodeVerify/EmailCodeVerify";
import { OAuthRow } from "../OAuthRow/OAuthRow";
import type { PassedFlowProps } from "./withPersistedPasswordlessFlow";
import { withPersistedPasswordlessFlow } from "./withPersistedPasswordlessFlow";

export const DEPENDENCIES = {
  BootLoading,
  EmailCodeStart,
  EmailCodeVerify,
  Link,
  OAuthRow,
  Turnstile: ClientOnlyTurnstile,
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
  const { checkSession, user, error } = d.useUser();
  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const [email, setEmail] = useState(props.initialEmail);
  const [screenKey, setScreenKey] = useState(0);
  const [isSessionRevalidated, setIsSessionRevalidated] = useState(false);
  const turnstileRef = useRef<TurnstileRef>(null);
  const hadCachedUserOnMountRef = useRef(!!user);

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

  /**
   * Sends a visitor who reached `?step=verify` without an in-flight email (a deep link, or a reload
   * after the flow was cleared) back to the entry screen. Skipped once authenticated: a successful
   * verification clears the persisted email and remounts this component (an ancestor provider swaps
   * on the anon→authed transition) with an empty `email`; firing here would `router.replace` back to
   * entry and clobber the post-verify `navigateBack()`.
   */
  useEffect(
    function redirectToEntryWhenEmailMissing() {
      if (user) return;
      if (screen === "verify" && !email) {
        goBackToEntry();
      }
    },
    [screen, email, goBackToEntry, user]
  );

  /**
   * The Auth0 client context can hold a stale user whose server session has already expired (the
   * session cookie outlives the access token). Trusting it here would `navigateBack()` to a gated
   * page whose SSR guard bounces straight back to /login — an infinite loop on a boot spinner
   * (DEPLOY-WEB-2C4). When a user is cached, re-fetch the profile to clear a dead one before any
   * navigation; a logged-out visitor has nothing to revalidate, so skip the redundant round trip.
   */
  useEffect(
    function revalidateSessionOnMount() {
      if (!hadCachedUserOnMountRef.current) {
        setIsSessionRevalidated(true);
        return;
      }
      checkSession().finally(() => setIsSessionRevalidated(true));
    },
    [checkSession]
  );

  /**
   * Auth0's `checkSession` keeps the cached user and only populates `error` when the profile
   * re-fetch itself fails (network error or 5xx, as opposed to a clean 401 that clears the user).
   * Gating on `!error` avoids navigating away on a stale user a transient failure couldn't confirm.
   */
  useEffect(
    function leaveWhenAuthenticated() {
      if (isSessionRevalidated && user && !error) navigateBack();
    },
    [isSessionRevalidated, user, error, navigateBack]
  );

  const handleVerified = useCallback(async () => {
    onFlowReset();
    await checkSession();
  }, [checkSession, onFlowReset]);

  const remountActiveScreen = useCallback(() => {
    setScreenKey(value => value + 1);
  }, []);

  if (user && !error) return <d.BootLoading />;

  return (
    <>
      <div className="flex w-full flex-col items-center gap-2 text-center">
        <h1 className="text-[30px] leading-9 text-neutral-950 dark:text-neutral-50">{screen === "verify" ? "Check your email" : "Start deploying"}</h1>
        {screen === "entry" && (
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
