import { toSameOriginPath } from "@src/utils/toSameOriginPath/toSameOriginPath";

/** Stands in for the page origin on the server, where only a relative path can be checked. */
const SERVER_SIDE_ORIGIN = "https://console.akash.network";

/**
 * Validates that a returnTo URL is safe to redirect to.
 * Only allows relative paths starting with "/" or same-origin URLs.
 * Prevents open redirect vulnerabilities.
 *
 * @param returnTo - The URL to validate (can be null/undefined)
 * @param providedWindow - Optional window object for same-origin validation. Defaults to global window if available.
 * @returns A same-origin path ("/" if invalid or null)
 */
export function getValidInternalReturnToUrl(returnTo: string | null, providedWindow = typeof window === "undefined" ? undefined : window): string {
  if (!returnTo) {
    return "/";
  }

  try {
    const decoded = decodeURIComponent(returnTo);
    const isPath = decoded.startsWith("/");
    const isHttpUrl = decoded.startsWith("http://") || decoded.startsWith("https://");

    if (!isPath && !(isHttpUrl && providedWindow)) {
      return "/";
    }

    return toSameOriginPath(decoded, providedWindow?.location.origin ?? SERVER_SIDE_ORIGIN) ?? "/";
  } catch {
    return "/";
  }
}
