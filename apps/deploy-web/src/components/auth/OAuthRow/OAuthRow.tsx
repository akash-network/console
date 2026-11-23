"use client";

import { useCallback } from "react";
import { Button } from "@akashnetwork/ui/components";

import { ColoredGoogleIcon } from "@src/components/icons/ColoredGoogleIcon";
import { GithubIcon } from "@src/components/icons/GithubIcon";
import { useServices } from "@src/context/ServicesProvider";
import { useInAppBrowser } from "@src/hooks/useInAppBrowser/useInAppBrowser";
import { useReturnTo } from "@src/hooks/useReturnTo/useReturnTo";
import { InAppBrowserNotice } from "../InAppBrowserNotice/InAppBrowserNotice";

export const DEPENDENCIES = {
  Button,
  ColoredGoogleIcon,
  GithubIcon,
  InAppBrowserNotice,
  useInAppBrowser,
  useReturnTo
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function OAuthRow({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const { authService, analyticsService } = useServices();
  const { returnTo } = d.useReturnTo({ defaultReturnTo: "/" });
  const inAppBrowser = d.useInAppBrowser();

  const redirectToSocialLogin = useCallback(
    async function redirectToSocialLogin(provider: "github" | "google-oauth2") {
      analyticsService.track("social_login_init", { provider }, "GA");
      await authService.loginViaOauth({ returnTo, connection: provider });
    },
    [analyticsService, authService, returnTo]
  );

  return (
    <div className="flex w-full flex-col gap-2.5">
      {inAppBrowser ? (
        <d.InAppBrowserNotice browser={inAppBrowser} />
      ) : (
        <d.Button
          type="button"
          variant="outline"
          onClick={() => redirectToSocialLogin("google-oauth2")}
          className="h-10 w-full gap-2 border-neutral-200 dark:border-neutral-800"
        >
          <d.ColoredGoogleIcon />
          Continue with Google
        </d.Button>
      )}
      <d.Button
        type="button"
        variant="outline"
        onClick={() => redirectToSocialLogin("github")}
        className="h-10 w-full gap-2 border-neutral-200 dark:border-neutral-800"
      >
        <d.GithubIcon />
        Continue with GitHub
      </d.Button>
    </div>
  );
}
