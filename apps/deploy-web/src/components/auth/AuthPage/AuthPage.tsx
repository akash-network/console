"use client";

import { useCallback } from "react";
import { isHttpError } from "@akashnetwork/http-sdk";
import { Alert, AlertDescription, Separator, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useMutation } from "@tanstack/react-query";
import { DollarSignIcon, RocketIcon, ZapIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { NextSeo } from "next-seo";

import { AkashConsoleLogo } from "@src/components/icons/AkashConsoleLogo";
import { useServices } from "@src/context/ServicesProvider";
import { AuthLayout } from "../AuthLayout/AuthLayout";
import type { SignInFormValues } from "../SignInForm/SignInForm";
import { SignInForm } from "../SignInForm/SignInForm";
import type { SignUpFormValues } from "../SignUpForm/SignUpForm";
import { SignUpForm } from "../SignUpForm/SignUpForm";
import { SocialAuth } from "../SocialAuth/SocialAuth";

export const DEPENDENCIES = {
  AuthLayout,
  NextSeo,
  SocialAuth,
  Alert,
  AlertDescription,
  SignInForm,
  SignUpForm,
  Tabs,
  TabsContent,
  TabsTrigger,
  TabsList,
  useUser,
  useSearchParams
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function AuthPage({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { authService, router } = useServices();
  const searchParams = d.useSearchParams();
  const { checkSession } = d.useUser();

  const redirectToSocialLogin = useCallback(
    async (provider: "github" | "google-oauth2") => {
      const returnUrl = searchParams.get("from") || searchParams.get("returnTo") || "/";
      await authService.loginViaOauth({ returnTo: returnUrl, connection: provider });
    },
    [searchParams]
  );
  const signInOrSignUp = useMutation({
    async mutationFn(input: Tagged<"signin", SignInFormValues> | Tagged<"signup", SignUpFormValues>) {
      const returnUrl = searchParams.get("from") || searchParams.get("returnTo") || "/";
      if (input.type === "signin") {
        await authService.login(input.value);
      } else {
        await authService.signup(input.value);
      }
      await checkSession();
      router.push(returnUrl);
    }
  });

  const activeTab = searchParams.get("tab") || "login";
  const setActiveTab = useCallback(
    (value: string) => {
      const tabId = value !== "login" && value !== "signup" ? "login" : value;
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set("tab", tabId);
      signInOrSignUp.reset();
      router.replace(`?${newSearchParams.toString()}`, undefined, { shallow: true });
    },
    [searchParams, router]
  );

  return (
    <d.AuthLayout
      sidebar={
        <div className="hidden max-w-[576px] flex-col gap-6 px-4 lg:flex">
          <AkashConsoleLogo size={{ width: 291, height: 32 }} />
          <p>The fastest way to deploy an application on Akash.Network</p>
          <div className="flex gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E5E5] bg-white" style={{ color: "hsl(var(--background))" }}>
              <ZapIcon />
            </div>
            <div className="flex-1">
              <h5 className="font-semibold">Generous Free Trial</h5>
              <p className="mt-1">$100 of cloud compute credits so you can test real workloads.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E5E5] bg-white" style={{ color: "hsl(var(--background))" }}>
              <RocketIcon />
            </div>
            <div className="flex-1">
              <h5 className="font-semibold">Optimized for AI/ML</h5>
              <p className="mt-1">Container native with a library of templates for leading open source AI models and applications.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#E5E5E5] bg-white" style={{ color: "hsl(var(--background))" }}>
              <DollarSignIcon />
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
        <div className="flex w-full max-w-[576px] flex-col items-center gap-6 rounded-[var(--radius)] bg-[hsl(var(--background))] px-3 py-4 sm:px-6 lg:rounded-none">
          <div className="flex w-full flex-col items-start justify-start gap-3">
            <h1 className="justify-start self-stretch text-2xl font-bold leading-tight text-neutral-950 sm:text-4xl sm:leading-10 dark:text-[var(--text-light)]">
              Log in or Sign up
            </h1>
            <p className="justify-start self-stretch text-sm font-normal leading-5 text-neutral-500 dark:text-neutral-400">
              Create your Akash account or log in to an existing one.
            </p>
          </div>

          <div className="relative w-full">
            <d.Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="mb-5 w-full">
                <d.TabsList className="m-0 flex h-auto max-w-[1304px] flex-1 items-center justify-start rounded-none border-0 border-l-0 border-r-0 border-t-0 bg-transparent p-0">
                  <d.TabsTrigger
                    value="login"
                    className="flex-1 cursor-pointer rounded-none border-0 border-b-2 border-l-0 border-r-0 border-t-0 border-b-transparent bg-transparent py-1.5 shadow-none transition-colors data-[state=active]:border-b-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:data-[state=active]:border-b-neutral-100"
                  >
                    <div className="flex items-center justify-center gap-2 px-2.5 py-2">
                      <span
                        className={`text-sm font-normal leading-5 transition-colors ${activeTab === "login" ? "text-neutral-950 dark:text-[var(--text-light)]" : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"}`}
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
                        className={`text-sm font-normal leading-5 transition-colors ${activeTab === "signup" ? "text-neutral-950 dark:text-[var(--text-light)]" : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"}`}
                      >
                        Sign up
                      </span>
                    </div>
                  </d.TabsTrigger>
                </d.TabsList>
              </div>

              <d.SocialAuth onSocialLogin={redirectToSocialLogin} />

              <div className="relative flex items-center justify-center self-stretch py-2.5">
                <Separator className="absolute inset-0 top-1/2" />
                <div className="current relative top-[-1px] z-10 px-2" style={{ backgroundColor: "hsl(var(--background))" }}>
                  <span className="relative top-1/2 text-xs font-normal text-neutral-500 dark:text-neutral-400">Or continue with</span>
                </div>
              </div>

              {signInOrSignUp.isError && (
                <d.Alert variant="destructive" className="mb-5">
                  <d.AlertDescription>
                    {isHttpError(signInOrSignUp.error) && signInOrSignUp.error.response?.data.message
                      ? signInOrSignUp.error.response.data.message
                      : "An unexpected error occurred. Please try again or contact support if the issue persists."}
                  </d.AlertDescription>
                </d.Alert>
              )}

              <d.TabsContent value="login" className="mt-0">
                <d.SignInForm isLoading={signInOrSignUp.isPending} onSubmit={value => signInOrSignUp.mutate({ type: "signin", value })} />
              </d.TabsContent>

              <d.TabsContent value="signup" className="mt-0">
                <d.SignUpForm isLoading={signInOrSignUp.isPending} onSubmit={value => signInOrSignUp.mutate({ type: "signup", value })} />
              </d.TabsContent>
            </d.Tabs>
          </div>
        </div>
      </>
    </d.AuthLayout>
  );
}

type Tagged<TType, TValue> = { type: TType; value: TValue };
