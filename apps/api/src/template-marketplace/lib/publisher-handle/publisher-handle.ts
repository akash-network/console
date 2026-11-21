import { slugCandidates } from "@src/organization/lib/slug/slug";
import { findReservedWords } from "@src/template-marketplace/lib/publish-checks/reserved-names";

const FALLBACK_HANDLE_PREFIX = "publisher";

/** `/v1/template-publishers/current` is the caller's own publisher, so no publisher may be reached by that word. */
export const HANDLES_TAKEN_BY_ROUTES: readonly string[] = ["current"];

/** A slug is cut to its length limit after its ends are trimmed, which can leave a hyphen the handle format refuses. */
function withoutTrailingHyphens(candidate: string): string {
  return candidate.replace(/-+$/, "");
}

export type HandleSource = { type: "personal" | "team"; slug: string; ownerUsername: string | null };

/** A personal organization's slug is derived from its owner's internal id, so its handle comes from the username instead; a name that reads as Akash's gets a neutral handle. */
export function publisherHandleCandidates({ type, slug, ownerUsername }: HandleSource, randomSuffix?: () => string): string[] {
  const wanted = type === "team" ? slug : ownerUsername ?? "";
  const allowed = findReservedWords(wanted).length > 0 ? "" : wanted;

  return slugCandidates(allowed, FALLBACK_HANDLE_PREFIX, randomSuffix)
    .map(withoutTrailingHyphens)
    .filter(candidate => !HANDLES_TAKEN_BY_ROUTES.includes(candidate));
}
