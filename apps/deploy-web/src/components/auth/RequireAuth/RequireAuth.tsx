import type { ReactNode } from "react";
import React, { useEffect } from "react";
import { useRouter } from "next/router";

import { Loading } from "@src/components/layout/Layout";
import { useUser } from "@src/hooks/useUser";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  useUser,
  useRouter,
  UrlService
};

type Props = {
  isPublic?: boolean;
  children: ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const RequireAuth = ({ isPublic, children, dependencies: d = DEPENDENCIES }: Props) => {
  const { user, isLoading } = d.useUser();
  const router = d.useRouter();
  const canRender = !!isPublic || !!user?.userId;
  const isOnLoginRoute = router.asPath.split("?")[0] === "/login";

  /**
   * Skips the redirect while already on /login. During the client-side redirect to /login, `asPath`
   * updates to the login URL before the public login page commits, so `canRender` is still false.
   * Re-redirecting here would stack another `returnTo` entry every render, producing an infinite
   * login→login loop.
   */
  useEffect(
    function redirectIfUnauthenticated() {
      if (isLoading || canRender || isOnLoginRoute) return;
      router.replace(d.UrlService.newLogin({ returnTo: router.asPath }));
    },
    [isLoading, canRender, isOnLoginRoute, router, d.UrlService]
  );

  if (canRender) return <>{children}</>;
  return <Loading text="" />;
};
