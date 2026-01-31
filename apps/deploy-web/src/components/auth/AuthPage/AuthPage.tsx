"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Separator, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { useMutation } from "@tanstack/react-query";
import { DollarSignIcon, RocketIcon, Undo2, ZapIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/router";
import { NextSeo } from "next-seo";

import { AkashConsoleLogo } from "@src/components/icons/AkashConsoleLogo";
import { RemoteApiError } from "@src/components/shared/RemoteApiError/RemoteApiError";
import type { TurnstileRef } from "@src/components/turnstile/Turnstile";
import { ClientOnlyTurnstile } from "@src/components/turnstile/Turnstile";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet as useWalletOriginal } from "@src/context/WalletProvider";
import { useReturnTo } from "@src/hooks/useReturnTo";
import { useUser } from "@src/hooks/useUser";
import { UrlService } from "@src/utils/urlUtils";
import { AuthLayout } from "../AuthLayout/AuthLayout";
import { ForgotPasswordForm } from "../ForgotPasswordForm/ForgotPasswordForm";
import type { SignInFormValues } from "../SignInForm/SignInForm";
import { SignInForm } from "../SignInForm/SignInForm";
import type { SignUpFormValues } from "../SignUpForm/SignUpForm";
import { SignUpForm } from "../SignUpForm/SignUpForm";
import { SocialAuth } from "../SocialAuth/SocialAuth";

export const DEPENDENCIES = {
  AuthLayout,
  NextSeo,
  SocialAuth,
  SignInForm,
  SignUpForm,
  RemoteApiError,
  ForgotPasswordForm,
  Turnstile: ClientOnlyTurnstile,
  Tabs,
  TabsContent,
  TabsTrigger,
  TabsList,
  DollarSignIcon,
  RocketIcon,
  ZapIcon,
  AkashConsoleLogo,
  Button,
  Separator,
  useUser,
  useSearchParams,
  useRouter,
  useReturnTo,
  useWallet: useWalletOriginal
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function AuthPage({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { authService, publicConfig, analyticsService } = useServices();
  const router = d.useRouter();
  const searchParams = d.useSearchParams();
  const { checkSession } = d.useUser();
  const [email, setEmail] = useState("");
  const turnstileRef = useRef<TurnstileRef | null>(null);
  const { returnTo, navigateBack, isDeploymentReturnTo } = d.useReturnTo({ defaultReturnTo: "/" });

  const redirectToSocialLogin = useCallback(
    async (provider: "github" | "google-oauth2") => {
      analyticsService.track("social_login_init", { provider });
      await authService.loginViaOauth({ returnTo: returnTo, connection: provider });
    },
    [analyticsService, authService, returnTo]
  );

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

  const activeView = searchParams.get("tab") || "login";
  const isFromSignup = searchParams.has("fromSignup");
  const setActiveView = useCallback(
    (value: string) => {
      if (value === "signup") {
        router.push(UrlService.onboarding({ returnTo: "/" }));
        return;
      }
      const tabId = value !== "login" && value !== "forgot-password" ? "login" : value;
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set("tab", tabId);
      resetMutations();
      router.replace(`?${newSearchParams.toString()}`, undefined, { shallow: true });
    },
    [searchParams, router]
  );

  useEffect(() => {
    if (activeView === "signup" && !isFromSignup) {
      router.replace(UrlService.onboarding({ returnTo: "/" }));
    }
  }, [activeView, isFromSignup, router]);

  const forgotPassword = useMutation({
    async mutationFn(input: { email: string }) {
      if (!turnstileRef.current) {
        throw new Error("Captcha has not been rendered");
      }
      const { token: captchaToken } = await turnstileRef.current.renderAndWaitResponse();
      await authService.sendPasswordResetEmail({ email: input.email, captchaToken });
    }
  });

  const resetMutations = useCallback(() => {
    signInOrSignUp.reset();
    forgotPassword.reset();
  }, [signInOrSignUp, forgotPassword]);

  return (
    <d.AuthLayout
      sidebar={
        <div className="hidden max-w-[576px] flex-col gap-6 px-4 lg:flex">
          <AkashConsoleLogo size={{ width: 291, height: 32 }} />
          <p>The fastest way to deploy an application on Akash.Network</p>
          <div className="flex gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E5E5] bg-white" style={{ color: "hsl(var(--background))" }}>
              <d.ZapIcon />
            </div>
            <div className="flex-1">
              <h5 className="font-semibold">Generous Free Trial</h5>
              <p className="mt-1">$100 of cloud compute credits so you can test real workloads.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E5E5] bg-white" style={{ color: "hsl(var(--background))" }}>
              <d.RocketIcon />
            </div>
            <div className="flex-1">
              <h5 className="font-semibold">Optimized for AI/ML</h5>
              <p className="mt-1">Container native with a library of templates for leading open source AI models and applications.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E5E5] bg-white" style={{ color: "hsl(var(--background))" }}>
              <d.DollarSignIcon />
            </div>
            <div className="flex-1">
              <h5 className="font-semibold">Cost Savings</h5>
              <p className="mt-1">The most competitive prices for GPUs on-demand, anywhere on the internet.</p>
            </div>
          </div>
        </div>
      }
    >
      <>
        <d.NextSeo title="Log in or Sign up" />
        <div className="w-full max-w-[576px] rounded-[var(--radius)] bg-[hsl(var(--background))] px-3 py-4 sm:px-6 lg:rounded-none">
          <div>
            <d.AkashConsoleLogo className="mb-4 lg:hidden" size={{ width: 291, height: 32 }} />
            <h1 className="text-xl font-bold leading-tight text-neutral-950 lg:text-4xl lg:leading-10 dark:text-[var(--foreground)]">
              {(activeView === "forgot-password" && "Reset your password") || (
                <div className="flex items-center">
                  <span>Log in or sign up</span>
                  <span className="lg:hidden"> to get started</span>
                </div>
              )}
            </h1>
            <p className="mt-2 text-sm leading-5 text-neutral-500 dark:text-neutral-400">
              {activeView === "forgot-password"
                ? "Enter your email address and we'll send you instructions to reset your password."
                : "Create your Akash account or log in to an existing one."}
            </p>
          </div>

          <div className="relative mt-4 w-full">
            {(activeView === "forgot-password" && (
              <>
                test me here?
                <d.RemoteApiError className="mb-5" error={forgotPassword.error} />
                <d.ForgotPasswordForm
                  defaultEmail={email}
                  status={forgotPassword.status}
                  onSubmit={forgotPassword.mutate}
                  onGoBack={() => setActiveView("login")}
                />
              </>
            )) ||
              (isDeploymentReturnTo && (
                <>
                  <d.SocialAuth onSocialLogin={redirectToSocialLogin} />
                  <div className="mt-4 flex">
                    <d.Button type="button" onClick={navigateBack} variant="outline" className="h-9 flex-1 border-neutral-200 dark:border-neutral-800">
                      <Undo2 className="mr-2 h-4 w-4" />
                      Go Back
                    </d.Button>
                  </div>
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

                  <d.SocialAuth onSocialLogin={redirectToSocialLogin} />

                  <div className="relative flex items-center justify-center self-stretch py-2.5">
                    <d.Separator className="absolute inset-0 top-1/2" />
                    <div className="current relative top-[-1px] z-10 px-2" style={{ backgroundColor: "hsl(var(--background))" }}>
                      <span className="relative top-1/2 text-xs font-normal text-neutral-500 dark:text-neutral-400">Or continue with</span>
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
        </div>
      </>
    </d.AuthLayout>
  );
}

type Tagged<TType, TValue> = { type: TType; value: TValue };
