import { SELF_CUSTODY_FLAG } from "@src/hooks/useIsSelfCustodyEnabled";
import type { AppTypedContext } from "../defineServerSideProps/defineServerSideProps";
import { isFeatureEnabled } from "./pageGuards";

export function isSelfCustodyEnabled(context: AppTypedContext): Promise<boolean> {
  return isFeatureEnabled(SELF_CUSTODY_FLAG, context);
}
