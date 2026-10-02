import type { ComponentProps } from "react";
import { createElement } from "react";
import NextLink from "next/link";

/** Every stats-web route renders per request with no loading boundary, so a prefetch costs the server a render and gives the click nothing to reuse. */
export function Link({ prefetch = false, ...props }: ComponentProps<typeof NextLink>) {
  return createElement(NextLink, { ...props, prefetch });
}
