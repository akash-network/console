import type { FC, ReactNode } from "react";

import { useUser } from "@src/hooks/useUser";

export const DEPENDENCIES = { useUser };

interface Props {
  /** True on a page the server rendered for a visitor with no session. */
  isRenderedForVisitor?: boolean;
  children: ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

/** The hosts act only for a signed-in user and reach for the browser while rendering, so a page rendered for a visitor mounts them once a session shows up. */
export const SignedInHosts: FC<Props> = ({ isRenderedForVisitor, children, dependencies: d = DEPENDENCIES }) => {
  const { user } = d.useUser();

  if (isRenderedForVisitor && !user?.userId) return null;
  return <>{children}</>;
};
