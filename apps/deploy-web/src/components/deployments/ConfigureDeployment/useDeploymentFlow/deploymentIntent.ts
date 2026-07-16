export type SdlStrategy = "default" | "edit";
export type BidStrategy = "auto" | "select";

export interface DeploymentIntent {
  templateId?: string;
  sdlStrategy: SdlStrategy;
  bidStrategy: BidStrategy;
  dseq?: string;
  /** Identifies the persisted working draft. Present once a configure session has started; absent on a fresh entry. */
  draftId?: string;
  /** Container-VM entry (`?vm=true`): the form seeds an SSH-ready VM service instead of the blank default. */
  vm: boolean;
}

interface ParseInput {
  /** The optional catch-all route segment (`/configure/[[...dseq]]`); the deployment's dseq once it exists. */
  dseqSegment: string | undefined;
  searchParams: URLSearchParams;
}

/**
 * Maps the declarative configure URL to a normalized intent. Strategy values fall back to the
 * safe manual defaults (`edit`/`select`) on anything unrecognized, and `sdl-strategy` is only
 * honored alongside a `templateId` (it governs creating *from a template*). A `vm=true` entry
 * is a Container-VM seed, not a template build: it drops any `templateId` (and with it the
 * `default` strategy), so the manual form always opens.
 */
export function parseDeploymentIntent({ dseqSegment, searchParams }: ParseInput): DeploymentIntent {
  const vm = searchParams.get("vm") === "true";
  const templateId = vm ? undefined : searchParams.get("templateId") ?? undefined;
  const sdlStrategy = templateId ? toSdlStrategy(searchParams.get("sdl-strategy")) : "edit";
  const bidStrategy = toBidStrategy(searchParams.get("bid-strategy"));
  const draftId = searchParams.get("draftId") || undefined;
  return { templateId, sdlStrategy, bidStrategy, dseq: dseqSegment || undefined, draftId, vm };
}

/** Narrows the raw `sdl-strategy` param to the union, defaulting to `edit`. */
function toSdlStrategy(value: string | null): SdlStrategy {
  return value === "default" ? "default" : "edit";
}

/** Narrows the raw `bid-strategy` param to the union, defaulting to `select`. */
function toBidStrategy(value: string | null): BidStrategy {
  return value === "auto" ? "auto" : "select";
}
