import type { IToggle } from "@unleash/nextjs";

/** What the server hands a page it rendered for a visitor with no session: the flags it rendered the page under, so the browser's first render matches. */
export interface VisitorAccess {
  featureToggles: IToggle[];
}

export interface VisitorPageProps {
  visitorAccess?: VisitorAccess;
}

export function readVisitorAccess(pageProps: unknown): VisitorAccess | undefined {
  if (!pageProps || typeof pageProps !== "object" || !("visitorAccess" in pageProps)) return undefined;

  const access = pageProps.visitorAccess;
  if (!access || typeof access !== "object" || !("featureToggles" in access) || !Array.isArray(access.featureToggles)) return undefined;

  return { featureToggles: access.featureToggles };
}
