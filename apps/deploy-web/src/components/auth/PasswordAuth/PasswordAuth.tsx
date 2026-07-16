"use client";

import { useCallback, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";

import { RemoteApiError } from "@src/components/shared/RemoteApiError/RemoteApiError";
import type { TurnstileRef } from "@src/components/turnstile/Turnstile";
import { ClientOnlyTurnstile } from "@src/components/turnstile/Turnstile";
import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useReturnTo } from "@src/hooks/useReturnTo/useReturnTo";
import { useUser } from "@src/hooks/useUser";
import { ForgotPasswordForm } from "../ForgotPasswordForm/ForgotPasswordForm";
import { OAuthRow } from "../OAuthRow/OAuthRow";
import type { SignInFormValues } from "../SignInForm/SignInForm";
import { SignInForm } from "../SignInForm/SignInForm";
import type { SignUpFormValues } from "../SignUpForm/SignUpForm";
import { SignUpForm } from "../SignUpForm/SignUpForm";

export const DEPENDENCIES = {
  ForgotPasswordForm,
  OAuthRow,
  RemoteApiError,
  SignInForm,
  SignUpForm,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Turnstile: ClientOnlyTurnstile,
  useFlag,
  useReturnTo,
  useRouter,
  useSearchParams,
  useUser
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

type Tagged<TType extends string, TValue> = { type: TType; value: TValue };

export function PasswordAuth({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { authService, publicConfig, analyticsService } = useServices();
  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const { checkSession } = d.useUser();
  const { navigateBack } = d.useReturnTo({ defaultReturnTo: "/" });
  const isOnboardingRedesignEnabled = d.useFlag("onboarding_redesign_v1");
  const [email, setEmail] = useState("");
  const turnstileRef = useRef<TurnstileRef | null>(null);

  const signInOrSignUp = useMutation({
    async mutationFn(input: Tagged<"signin", SignInFormValues> | Tagged<"signup", SignUpFormValues>) {
      analyticsService.track("password_auth_submit", { type: input.type });
      if (!turnstileRef.current) {
        throw new Error("Captcha has not been rendered");
      }

      const { token: captchaToken } = await turnstileRef.current.renderAndWaitResponse();

      if (input.type === "signin") {
        await authService.login({ ...input.value, captchaToken });
      } else {
        await authService.signup({ ...input.value, captchaToken });
      }
      await checkSession();
      navigateBack();
    }
  });

  const forgotPassword = useMutation({
    async mutationFn(input: { email: string }) {
      if (!turnstileRef.current) {
        throw new Error("Captcha has not been rendered");
      }
      const { token: captchaToken } = await turnstileRef.current.renderAndWaitResponse();
      await authService.sendPasswordResetEmail({ email: input.email, captchaToken });
    }
  });

  const resetMutations = useCallback(
    function resetMutations() {
      signInOrSignUp.reset();
      forgotPassword.reset();
    },
    [signInOrSignUp, forgotPassword]
  );

  const requestedTab = searchParams.get("tab");
  const activeView = requestedTab !== "login" && requestedTab !== "signup" && requestedTab !== "forgot-password" ? "login" : requestedTab;
  const setActiveView = useCallback(
    function setActiveView(value: string) {
      const tabId = value !== "login" && value !== "signup" && value !== "forgot-password" ? "login" : value;
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set("tab", tabId);
      resetMutations();
      router.replace(`?${newSearchParams.toString()}`, undefined, { shallow: true });
    },
    [searchParams, router, resetMutations]
  );

  return (
    <>
      <div className="flex w-full flex-col items-center gap-2 text-center">
        <h1 className="text-[30px] leading-9 text-neutral-950 dark:text-neutral-50">
          {activeView === "forgot-password" ? "Reset your password" : "Log in or sign up"}
        </h1>
        <p className="text-sm leading-5 text-neutral-500 dark:text-neutral-400">
          {activeView === "forgot-password"
            ? "Enter your email address and we'll send you instructions to reset your password."
            : "Create your Akash account or log in to an existing one."}
        </p>
        {activeView !== "forgot-password" && isOnboardingRedesignEnabled && (
          <p className="text-sm leading-5 text-neutral-500 dark:text-neutral-400">$1 credit to deploy your first container. No card required.</p>
        )}
      </div>

      <div className="relative w-full">
        {(activeView === "forgot-password" && (
          <>
            <d.RemoteApiError className="mb-5" error={forgotPassword.error} />
            <d.ForgotPasswordForm
              defaultEmail={email}
              status={forgotPassword.status}
              onSubmit={forgotPassword.mutate}
              onGoBack={() => setActiveView("login")}
            />
          </>
        )) || (
          <d.Tabs value={activeView} onValueChange={setActiveView} className="w-full">
            <div className="mb-5 w-full">
              <d.TabsList className="m-0 flex h-auto max-w-[1304px] flex-1 items-center justify-start rounded-none border-0 border-l-0 border-r-0 border-t-0 bg-transparent p-0">
                <d.TabsTrigger
                  value="login"
                  className="flex-1 cursor-pointer rounded-none border-0 border-b-2 border-l-0 border-r-0 border-t-0 border-b-transparent bg-transparent py-1.5 shadow-none transition-colors data-[state=active]:border-b-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:data-[state=active]:border-b-neutral-100"
                >
                  <div className="flex items-center justify-center gap-2 px-2.5 py-2">
                    <span
                      className={`text-sm font-normal leading-5 transition-colors ${activeView === "login" ? "text-neutral-950 dark:text-[var(--text-light)]" : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"}`}
                    >
                      Log in
                    </span>
                  </div>
                </d.TabsTrigger>
                <d.TabsTrigger
                  value="signup"
                  className="flex-1 cursor-pointer rounded-none border-0 border-b-2 border-l-0 border-r-0 border-t-0 border-b-transparent bg-transparent py-1.5 shadow-none transition-colors data-[state=active]:border-b-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:data-[state=active]:border-b-neutral-100"
                >
                  <div className="flex items-center justify-center gap-2 px-2.5 py-2">
                    <span
                      className={`text-sm font-normal leading-5 transition-colors ${activeView === "signup" ? "text-neutral-950 dark:text-[var(--text-light)]" : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"}`}
                    >
                      Sign up
                    </span>
                  </div>
                </d.TabsTrigger>
              </d.TabsList>
            </div>

            <div className="mb-5 flex w-full flex-col items-center gap-6">
              <d.OAuthRow />
              <div className="flex w-full items-center gap-3">
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">OR</span>
                <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
              </div>
            </div>

            <d.RemoteApiError className="mb-5" error={signInOrSignUp.error} />

            <d.TabsContent value="login" className="mt-0">
              <d.SignInForm
                isLoading={signInOrSignUp.isPending}
                defaultEmail={email}
                onEmailChange={setEmail}
                onSubmit={value => signInOrSignUp.mutate({ type: "signin", value })}
                onForgotPasswordClick={() => setActiveView("forgot-password")}
              />
            </d.TabsContent>

            <d.TabsContent value="signup" className="mt-0">
              <d.SignUpForm isLoading={signInOrSignUp.isPending} onSubmit={value => signInOrSignUp.mutate({ type: "signup", value })} />
            </d.TabsContent>
          </d.Tabs>
        )}
        <d.Turnstile
          turnstileRef={turnstileRef}
          enabled={publicConfig.NEXT_PUBLIC_TURNSTILE_ENABLED}
          siteKey={publicConfig.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          onDismissed={resetMutations}
        />
      </div>
    </>
  );
}
