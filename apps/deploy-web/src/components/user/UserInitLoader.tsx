import type { FC } from "react";
import React from "react";

import { BootLoading } from "@src/context/BootLoadingProvider/BootLoadingProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import type { FCWithChildren } from "@src/types/component";

export const DEPENDENCIES: { useCustomUser: typeof useCustomUser; BootLoading: FC } = { useCustomUser, BootLoading };

interface Props {
  /** True on a page the server rendered for a visitor with no session: it shows at once, and the session check that follows only confirms there is none. */
  isRenderedForVisitor?: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const UserInitLoader: FCWithChildren<Props> = ({ children, isRenderedForVisitor, dependencies: d = DEPENDENCIES }) => {
  const { isLoading } = d.useCustomUser();

  if (isLoading && !isRenderedForVisitor) return <d.BootLoading />;
  return <>{children}</>;
};
