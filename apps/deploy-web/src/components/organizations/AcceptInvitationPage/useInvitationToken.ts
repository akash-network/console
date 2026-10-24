import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import { forgetInvitationToken, readStoredInvitationToken, storeInvitationToken } from "@src/lib/organization-invitation/invitation-token-storage";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useRouter };

/** Reads the token from the `#token=` fragment, else from this tab's storage, then follows the token of any later link opened in the tab; undefined until read, null when there is none. */
export function useInvitationToken({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}) {
  const router = d.useRouter();
  const [token, setToken] = useState<string | null>();
  const hasReadToken = useRef(false);

  const takeFragmentToken = useCallback(
    (fragmentToken: string) => {
      storeInvitationToken(fragmentToken);
      router.replace(UrlService.invitations(), undefined, { shallow: true });
      setToken(fragmentToken);
    },
    [router]
  );

  useEffect(
    function readInvitationToken() {
      if (hasReadToken.current) return;
      hasReadToken.current = true;

      const fragmentToken = readFragmentToken();
      if (fragmentToken) {
        takeFragmentToken(fragmentToken);
      } else {
        setToken(readStoredInvitationToken());
      }
    },
    [takeFragmentToken]
  );

  useEffect(
    function followInvitationLinksOpenedInThisTab() {
      const followFragment = () => {
        const fragmentToken = readFragmentToken();
        if (fragmentToken) takeFragmentToken(fragmentToken);
      };

      window.addEventListener("hashchange", followFragment);
      return () => window.removeEventListener("hashchange", followFragment);
    },
    [takeFragmentToken]
  );

  return { token, forgetToken: forgetInvitationToken };
}

function readFragmentToken(): string | null {
  return new URLSearchParams(window.location.hash.slice(1)).get("token");
}
