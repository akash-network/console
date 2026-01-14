import type { FC } from "react";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingBlocker } from "@src/components/layout/LoadingBlocker/LoadingBlocker";
import { useServices } from "@src/context/ServicesProvider";
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
  const { urlService } = useServices();

  useEffect(() => {
    if (!user && !isLoading) {
      router.push(urlService.newLogin());
    }
  }, [user, isLoading, router]);

  return <LoadingBlocker isLoading={isLoading}>{typeof children === "function" ? children(user) : children}</LoadingBlocker>;
};
