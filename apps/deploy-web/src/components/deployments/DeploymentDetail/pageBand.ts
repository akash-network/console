/** Matches Layout's default `container p-6` content column so every band lines up with the deployment list and the
 *  other pages. Sits inside each full-bleed wrapper, so the header, tab labels and tab body all share one left edge. */
export const PAGE_BAND = "container px-6";

/** Cancels the side padding of {@link PAGE_BAND} below `sm`, so a log viewer, terminal or editor inside it spans the whole phone screen. */
export const EDGE_TO_EDGE_ON_PHONES = "-mx-6 sm:mx-0";
