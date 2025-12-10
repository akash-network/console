"use client";

import { useCallback } from "react";
import { isHttpError } from "@akashnetwork/http-sdk";
import { Alert, AlertDescription, Separator, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useMutation } from "@tanstack/react-query";
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
      router.replace(`?${newSearchParams.toString()}`);
    },
    [searchParams, router]
  );

  return (
    <d.AuthLayout
      sidebar={
        <div className="hidden max-w-[576px] flex-col gap-6 px-4 lg:flex">
          <AkashConsoleLogo size={{ width: 291, height: 32 }} />
          <p>The fastest way to deploy application on Akash.Network</p>
          <div className="flex gap-4">
            <TrialIcon />
            <div className="flex-1">
              <h5 className="font-semibold">Generous Free Trial</h5>
              <p className="mt-1">$100 of cloud compute credits so you can test real workloads.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <AIMLIcon />
            <div className="flex-1">
              <h5 className="font-semibold">Optimized for AI/ML</h5>
              <p className="mt-1">Container native with a library of templates for leading open source AI models and applications.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <CostIcon />
            <div className="flex-1">
              <h5 className="font-semibold">Cost Savings</h5>
              <p className="mt-1">The most competitive prices for GPUs on-demands, anywhere on the internet.</p>
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

function TrialIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g filter="url(#filter0_d_294_2946)">
        <mask id="path-1-inside-1_294_2946" fill="white">
          <path d="M2 9C2 4.58172 5.58172 1 10 1H34C38.4183 1 42 4.58172 42 9V33C42 37.4183 38.4183 41 34 41H10C5.58172 41 2 37.4183 2 33V9Z" />
        </mask>
        <path d="M2 9C2 4.58172 5.58172 1 10 1H34C38.4183 1 42 4.58172 42 9V33C42 37.4183 38.4183 41 34 41H10C5.58172 41 2 37.4183 2 33V9Z" fill="white" />
        <path
          d="M10 1V2H34V1V0H10V1ZM42 9H41V33H42H43V9H42ZM34 41V40H10V41V42H34V41ZM2 33H3V9H2H1V33H2ZM10 41V40C6.13401 40 3 36.866 3 33H2H1C1 37.9706 5.02944 42 10 42V41ZM42 33H41C41 36.866 37.866 40 34 40V41V42C38.9706 42 43 37.9706 43 33H42ZM34 1V2C37.866 2 41 5.13401 41 9H42H43C43 4.02944 38.9706 0 34 0V1ZM10 1V0C5.02944 0 1 4.02944 1 9H2H3C3 5.13401 6.13401 2 10 2V1Z"
          fill="#E5E5E5"
          mask="url(#path-1-inside-1_294_2946)"
        />
        <path
          d="M15.3333 22.6667C15.1756 22.6672 15.021 22.623 14.8875 22.5391C14.7539 22.4553 14.6469 22.3353 14.5788 22.193C14.5107 22.0508 14.4844 21.8921 14.5029 21.7355C14.5214 21.5789 14.584 21.4308 14.6833 21.3083L22.9333 12.8083C22.9952 12.7369 23.0796 12.6886 23.1725 12.6714C23.2654 12.6543 23.3614 12.6692 23.4448 12.7137C23.5281 12.7583 23.5938 12.8299 23.6311 12.9168C23.6684 13.0036 23.6751 13.1005 23.65 13.1917L22.05 18.2083C22.0028 18.3346 21.987 18.4704 22.0038 18.6042C22.0207 18.7379 22.0697 18.8656 22.1467 18.9762C22.2238 19.0868 22.3265 19.1771 22.4461 19.2393C22.5657 19.3015 22.6985 19.3338 22.8333 19.3333H28.6667C28.8244 19.3328 28.979 19.377 29.1125 19.4608C29.2461 19.5447 29.3531 19.6647 29.4212 19.8069C29.4893 19.9492 29.5156 20.1078 29.4971 20.2644C29.4786 20.4211 29.416 20.5692 29.3167 20.6917L21.0667 29.1917C21.0048 29.2631 20.9205 29.3114 20.8275 29.3285C20.7346 29.3457 20.6386 29.3308 20.5552 29.2862C20.4719 29.2417 20.4062 29.1701 20.3689 29.0832C20.3316 28.9964 20.3249 28.8995 20.35 28.8083L21.95 23.7917C21.9972 23.6654 22.013 23.5296 21.9962 23.3958C21.9793 23.2621 21.9303 23.1344 21.8533 23.0238C21.7762 22.9132 21.6735 22.8229 21.5539 22.7607C21.4344 22.6985 21.3015 22.6662 21.1667 22.6667H15.3333Z"
          stroke="#0A0A0A"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <filter id="filter0_d_294_2946" x="0" y="0" width="44" height="44" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="1" />
          <feGaussianBlur stdDeviation="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_294_2946" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_294_2946" result="shape" />
        </filter>
      </defs>
    </svg>
  );
}

function AIMLIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g filter="url(#filter0_d_294_2958)">
        <mask id="path-1-inside-1_294_2958" fill="white">
          <path d="M2 9C2 4.58172 5.58172 1 10 1H34C38.4183 1 42 4.58172 42 9V33C42 37.4183 38.4183 41 34 41H10C5.58172 41 2 37.4183 2 33V9Z" />
        </mask>
        <path d="M2 9C2 4.58172 5.58172 1 10 1H34C38.4183 1 42 4.58172 42 9V33C42 37.4183 38.4183 41 34 41H10C5.58172 41 2 37.4183 2 33V9Z" fill="white" />
        <path
          d="M10 1V2H34V1V0H10V1ZM42 9H41V33H42H43V9H42ZM34 41V40H10V41V42H34V41ZM2 33H3V9H2H1V33H2ZM10 41V40C6.13401 40 3 36.866 3 33H2H1C1 37.9706 5.02944 42 10 42V41ZM42 33H41C41 36.866 37.866 40 34 40V41V42C38.9706 42 43 37.9706 43 33H42ZM34 1V2C37.866 2 41 5.13401 41 9H42H43C43 4.02944 38.9706 0 34 0V1ZM10 1V0C5.02944 0 1 4.02944 1 9H2H3C3 5.13401 6.13401 2 10 2V1Z"
          fill="#E5E5E5"
          mask="url(#path-1-inside-1_294_2958)"
        />
        <path
          d="M22 23.5L19.5 21M22 23.5C23.164 23.0573 24.2807 22.4989 25.3333 21.8333M22 23.5V27.6667C22 27.6667 24.525 27.2083 25.3333 26C26.2333 24.65 25.3333 21.8333 25.3333 21.8333M19.5 21C19.9434 19.8495 20.5018 18.7467 21.1667 17.7083C22.1376 16.1558 23.4897 14.8776 25.0942 13.9951C26.6986 13.1126 28.5022 12.6553 30.3333 12.6667C30.3333 14.9333 29.6833 18.9167 25.3333 21.8333M19.5 21L15.3333 21C15.3333 21 15.7917 18.475 17 17.6667C18.35 16.7667 21.1667 17.6667 21.1667 17.6667M15.75 24.7501C14.5 25.8001 14.0833 28.9167 14.0833 28.9167C14.0833 28.9167 17.2 28.5001 18.25 27.2501C18.8417 26.5501 18.8333 25.4751 18.175 24.8251C17.8511 24.5159 17.4244 24.3373 16.9768 24.3234C16.5293 24.3096 16.0924 24.4615 15.75 24.7501Z"
          stroke="#0A0A0A"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <filter id="filter0_d_294_2958" x="0" y="0" width="44" height="44" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="1" />
          <feGaussianBlur stdDeviation="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_294_2958" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_294_2958" result="shape" />
        </filter>
      </defs>
    </svg>
  );
}

function CostIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g filter="url(#filter0_d_294_2952)">
        <mask id="path-1-inside-1_294_2952" fill="white">
          <path d="M2 9C2 4.58172 5.58172 1 10 1H34C38.4183 1 42 4.58172 42 9V33C42 37.4183 38.4183 41 34 41H10C5.58172 41 2 37.4183 2 33V9Z" />
        </mask>
        <path d="M2 9C2 4.58172 5.58172 1 10 1H34C38.4183 1 42 4.58172 42 9V33C42 37.4183 38.4183 41 34 41H10C5.58172 41 2 37.4183 2 33V9Z" fill="white" />
        <path
          d="M10 1V2H34V1V0H10V1ZM42 9H41V33H42H43V9H42ZM34 41V40H10V41V42H34V41ZM2 33H3V9H2H1V33H2ZM10 41V40C6.13401 40 3 36.866 3 33H2H1C1 37.9706 5.02944 42 10 42V41ZM42 33H41C41 36.866 37.866 40 34 40V41V42C38.9706 42 43 37.9706 43 33H42ZM34 1V2C37.866 2 41 5.13401 41 9H42H43C43 4.02944 38.9706 0 34 0V1ZM10 1V0C5.02944 0 1 4.02944 1 9H2H3C3 5.13401 6.13401 2 10 2V1Z"
          fill="#E5E5E5"
          mask="url(#path-1-inside-1_294_2952)"
        />
        <path
          d="M22 12.6667V29.3334M26.1667 15.1667H19.9167C19.1431 15.1667 18.4013 15.474 17.8543 16.021C17.3073 16.5679 17 17.3098 17 18.0834C17 18.8569 17.3073 19.5988 17.8543 20.1457C18.4013 20.6927 19.1431 21 19.9167 21H24.0833C24.8569 21 25.5987 21.3073 26.1457 21.8543C26.6927 22.4013 27 23.1431 27 23.9167C27 24.6902 26.6927 25.4321 26.1457 25.9791C25.5987 26.5261 24.8569 26.8334 24.0833 26.8334H17"
          stroke="#0A0A0A"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <filter id="filter0_d_294_2952" x="0" y="0" width="44" height="44" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dy="1" />
          <feGaussianBlur stdDeviation="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.05 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_294_2952" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_294_2952" result="shape" />
        </filter>
      </defs>
    </svg>
  );
}

type Tagged<TType, TValue> = { type: TType; value: TValue };
