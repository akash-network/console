/**
 * Validates that a returnTo URL is safe to redirect to.
 * Only allows relative paths starting with "/" or same-origin URLs.
 * Prevents open redirect vulnerabilities.
 *
 * @param returnTo - The URL to validate (can be null/undefined)
 * @param providedWindow - Optional window object for same-origin validation. Defaults to global window if available.
 * @returns A safe redirect URL (returns "/" if invalid or null)
 */
export function getValidInternalReturnToUrl(returnTo: string | null, providedWindow = typeof window === "undefined" ? undefined : window): string {
  if (!returnTo) {
    return "/";
  }

  try {
    const decoded = decodeURIComponent(returnTo);

    if (decoded.startsWith("/") && !decoded.startsWith("//")) {
      return decoded;
    }

    if (!decoded.startsWith("http://") && !decoded.startsWith("https://")) {
      return "/";
    }

    if (typeof providedWindow !== "undefined") {
      try {
        const url = new URL(decoded, providedWindow.location.origin);
        const windowOrigin = new URL(providedWindow.location.origin).origin;
        return url.origin === windowOrigin ? url.toString() : "/";
      } catch {
        return "/";
      }
    }

    return "/";
  } catch {
    return "/";
  }
}
