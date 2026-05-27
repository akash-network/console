import type { ComponentType } from "react";

export type PublicPageMarker = "public";

export type PageWithAuth<P = unknown> = ComponentType<P> & { auth?: PublicPageMarker };

/**
 * Marks a Next.js page as publicly accessible. The marker is read by `RequireAuth`
 * in `_app.tsx` to skip the auth gate for this page.
 */
export function definePublicPage<P>(Component: ComponentType<P>): PageWithAuth<P> {
  const Page = Component as PageWithAuth<P>;
  Page.auth = "public";
  return Page;
}
