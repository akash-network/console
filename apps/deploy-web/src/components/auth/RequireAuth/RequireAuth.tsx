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

  useEffect(
    function redirectIfUnauthenticated() {
      if (isLoading || canRender) return;
      router.replace(d.UrlService.newLogin({ returnTo: router.asPath }));
    },
    [isLoading, canRender, router, d.UrlService]
  );

  if (canRender) return <>{children}</>;
  return <Loading text="" />;
};
