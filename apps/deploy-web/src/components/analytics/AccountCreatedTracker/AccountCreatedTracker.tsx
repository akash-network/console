import { useEffect } from "react";
import { useRouter } from "next/router";

import { useServices } from "@src/context/ServicesProvider";
import { ACCOUNT_CREATED_COOKIE } from "@src/lib/analytics/account-created-cookie";

export const DEPENDENCIES = { useServices, useRouter };

type AccountCreatedTrackerProps = {
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Fires `account_created` from the browser once, right after a new account is created. The server auth callbacks hand
 * off the signal via a one-shot cookie; checked on mount (OAuth full-reload landing) and on route changes (passwordless
 * client-side nav).
 */
export function AccountCreatedTracker({ dependencies: d = DEPENDENCIES }: AccountCreatedTrackerProps = {}) {
  const { analyticsService } = d.useServices();
  const router = d.useRouter();

  useEffect(
    function trackAccountCreatedFromCookie() {
      function fireWhenNewAccount() {
        if (!consumeAccountCreatedCookie()) return;
        analyticsService.track("account_created", { category: "user" });
        analyticsService.flush();
      }

      fireWhenNewAccount();
      router.events?.on("routeChangeComplete", fireWhenNewAccount);
      return function unsubscribe() {
        router.events?.off("routeChangeComplete", fireWhenNewAccount);
      };
    },
    [analyticsService, router.events]
  );

  return null;
}

/** Reads the one-shot cookie and clears it, returning whether it was set so the event fires exactly once. */
function consumeAccountCreatedCookie() {
  if (typeof document === "undefined") return false;

  const isPresent = document.cookie.split("; ").some(entry => entry === `${ACCOUNT_CREATED_COOKIE}=1`);
  if (isPresent) {
    document.cookie = `${ACCOUNT_CREATED_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }

  return isPresent;
}
