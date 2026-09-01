import { useCallback } from "react";
import { useSetAtom } from "jotai";

import type { AddCreditsRequest } from "@src/store/addCreditsStore";
import { addCreditsRequestAtom } from "@src/store/addCreditsStore";

/** Opens the app-wide Add Credits sheet where the user already is, so selling credits never costs a navigation. */
export function useAddCredits() {
  const requestAddCredits = useSetAtom(addCreditsRequestAtom);

  return useCallback((request: AddCreditsRequest = {}) => requestAddCredits(request), [requestAddCredits]);
}
