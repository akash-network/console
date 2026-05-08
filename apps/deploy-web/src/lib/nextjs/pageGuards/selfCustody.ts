import { SELF_CUSTODY_FLAG } from "@src/hooks/useIsSelfCustodyEnabled";
import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "./pageGuards";

export const SELF_CUSTODY_ROUTES = ["/get-started/wallet", "/mint-burn", "/settings", "/settings/authorizations"];

export function isSelfCustodyEnabled(context: AppTypedContext): Promise<boolean> {
  return isFeatureEnabled(SELF_CUSTODY_FLAG, context);
}

export function isSelfCustodyRoute(path: string): boolean {
  const normalized = path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  return SELF_CUSTODY_ROUTES.includes(normalized);
}
