import type { FeatureFlag } from "@src/types/feature-flags";
import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "./pageGuards";

export const SELF_CUSTODY_ROUTES = ["/get-started/wallet", "/settings", "/settings/authorizations"];

export function isSelfCustodyEnabled(context: AppTypedContext): Promise<boolean> {
  return isFeatureEnabled("self_custody" satisfies FeatureFlag, context);
}

export function isSelfCustodyRoute(path: string): boolean {
  const normalized = path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  return SELF_CUSTODY_ROUTES.includes(normalized);
}
