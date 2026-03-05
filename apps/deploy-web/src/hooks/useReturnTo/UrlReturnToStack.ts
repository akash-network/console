import { getValidInternalReturnToUrl } from "@src/utils/getValidInternalReturnToUrl/getValidInternalReturnToUrl";

/** Extra query params to merge into a pushed returnTo entry. */
export type ExtraQueryParams = Record<string, string | number | boolean | null | undefined>;

/**
 * Utilities for building and consuming a multi-`returnTo` stack stored in URL query params.
 *
 * Stack representation:
 * - The stack is encoded as multiple `returnTo` query params in order.
 * - Legacy `from` is supported as a single-entry fallback when no `returnTo` params exist.
 *
 * Safety:
 * - `getReturnTo()` always validates the popped destination via `getValidInternalReturnToUrl`.
 * - Invalid values resolve to `"/"`.
 */
export class UrlReturnToStack {
  /**
   * Compute the next navigation URL by popping the top returnTo entry from `location`.
   * The returned URL also carries the remaining stack forward as `returnTo` params.
   *
   * @param location - Absolute URL or path-like string representing the current location.
   */
  static getReturnTo(location: string) {
    return new UrlReturnToStack(location).getReturnTo();
  }

  /**
   * Build a URL for navigating to `targetPath` while pushing the current `location` onto the returnTo stack.
   *
   * @param location - Absolute URL or path-like string representing the current location.
   * @param targetPath - Absolute URL or path-like string representing the navigation target.
   * @param options - Optional options for the pushed returnTo entry.
   */
  static createReturnable(location: string, targetPath: string, options?: { extraQueryParams?: ExtraQueryParams }) {
    return new UrlReturnToStack(location).createReturnable(targetPath, options);
  }

  readonly #current: { pathname: string; params: URLSearchParams } | null;

  /**
   * @param currentLocation - Absolute URL or path-like string; query params are supported; fragments are ignored.
   */
  private constructor(currentLocation: string) {
    this.#current = currentLocation ? this.#parsePathLike(currentLocation) : null;
  }

  /**
   * Builds a URL for navigating to `targetPath` while pushing the current location onto the returnTo stack.
   *
   * Stack rules:
   * - Preserves all existing `returnTo` params (in order), or falls back to legacy `from`.
   * - Pushes the current route (pathname + search), stripped of any returnTo/from params.
   * - Optionally merges `extraQueryParams` into the pushed returnTo entry (not the target URL).
   */
  createReturnable(targetPath: string, options?: { extraQueryParams?: ExtraQueryParams }): string {
    const target = this.#parsePathLike(targetPath);
    const stack = this.#getExistingReturnToStack(this.#current?.params);
    const pushed = this.#current ? this.#stripReturnToParams(this.#current) : null;

    if (pushed) {
      stack.push(this.#mergeExtraParamsIntoReturnTo(pushed, options?.extraQueryParams));
    }

    if (!stack.length) {
      const qs = target.params.toString();
      return `${target.pathname}${qs ? `?${qs}` : ""}`;
    }

    stack.forEach(item => target.params.append("returnTo", item));
    const qs = target.params.toString();

    return `${target.pathname}${qs ? `?${qs}` : ""}`;
  }

  /**
   * Returns the URL to navigate to by popping the top returnTo entry.
   * The returned URL also carries the remaining stack forward as `returnTo` params.
   */
  getReturnTo(): string {
    if (!this.#current) return "/";

    const stack = this.#getExistingReturnToStack(this.#current.params);
    if (!stack.length) return "/";

    const destination = stack[stack.length - 1];
    const remaining = stack.slice(0, -1);

    const validated = getValidInternalReturnToUrl(destination);
    if (!validated || validated === "/") return "/";

    const dest = this.#parsePathLike(validated);
    dest.params.delete("returnTo");
    dest.params.delete("from");
    remaining.forEach(v => dest.params.append("returnTo", v));

    const qs = dest.params.toString();
    return `${dest.pathname}${qs ? `?${qs}` : ""}`;
  }

  #getExistingReturnToStack(params: URLSearchParams | undefined): string[] {
    if (!params) return [];

    const all = params.getAll("returnTo");
    if (all.length > 0) return [...all];

    const from = params.get("from");
    return from ? [from] : [];
  }

  #normalizePath(p: string) {
    if (!p) return "/";
    return p.startsWith("/") ? p : `/${p}`;
  }

  #parsePathLike(input: string): { pathname: string; params: URLSearchParams } {
    const withoutHash = input.split("#")[0] || "";

    /**
     * Absolute URL input.
     *
     * Note: the returned `pathname` is relative; origin is intentionally discarded.
     */
    if (withoutHash.startsWith("http://") || withoutHash.startsWith("https://")) {
      const u = new URL(withoutHash);
      return { pathname: u.pathname || "/", params: new URLSearchParams(u.searchParams) };
    }

    const normalized = this.#normalizePath(withoutHash);
    const qIndex = normalized.indexOf("?");
    const pathname = qIndex === -1 ? normalized : normalized.slice(0, qIndex);
    const query = qIndex === -1 ? "" : normalized.slice(qIndex + 1);
    return { pathname: pathname || "/", params: new URLSearchParams(query) };
  }

  #mergeExtraParamsIntoReturnTo(returnTo: string, extra?: ExtraQueryParams): string {
    if (!extra || Object.keys(extra).length === 0) return returnTo;

    const u = this.#parsePathLike(returnTo);

    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined || v === null) continue;
      u.params.set(k, String(v));
    }

    const qs = u.params.toString();
    return `${u.pathname}${qs ? `?${qs}` : ""}`;
  }

  #stripReturnToParams(current: { pathname: string; params: URLSearchParams }): string {
    const params = new URLSearchParams(current.params);
    params.delete("returnTo");
    params.delete("from");

    const qs = params.toString();
    return `${current.pathname}${qs ? `?${qs}` : ""}`;
  }
}
