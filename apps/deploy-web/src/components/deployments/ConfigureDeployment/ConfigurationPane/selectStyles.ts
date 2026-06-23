/**
 * Trigger className that makes a Select's selected value left-align and
 * single-line-ellipsis when it overflows. The shared `SelectTrigger` applies
 * `line-clamp-1` to its value span, which renders as a `-webkit-box` and
 * visually centers a truncated value; this override restores left-aligned
 * `truncate` behaviour for the long labels used in the Hardware section.
 */
export const SELECT_TRUNCATE_VALUE =
  "[&>span:first-child]:line-clamp-none [&>span:first-child]:flex-1 [&>span:first-child]:truncate [&>span:first-child]:text-left";
