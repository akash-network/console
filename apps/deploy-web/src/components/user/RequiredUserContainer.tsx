import React, { FC, useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import { useCustomUser } from "@src/hooks/useCustomUser";
import type { CustomUserProfile } from "@src/types/user";

export type RequiredUserConsumer<P = object> = FC<
  {
    user: CustomUserProfile;
  } & P
>;

type RequiredUserContainerProps = {
  children: React.ReactNode | ((user: CustomUserProfile) => React.ReactNode);
};

export const RequiredUserContainer: FC<RequiredUserContainerProps> = ({ children }) => {
  const { user, isLoading } = useCustomUser();
  const router = useRouter();

  useEffect(() => {
    if (!user && !isLoading) {
      router.push("/404");
    }
  }, [user, isLoading, router]);

  return <LoadingBlocker isLoading={isLoading}>{typeof children === "function" ? children(user) : children}</LoadingBlocker>;
};
