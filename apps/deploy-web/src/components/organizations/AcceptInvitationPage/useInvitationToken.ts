import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import { forgetInvitationToken, readStoredInvitationToken, storeInvitationToken } from "@src/lib/organization-invitation/invitation-token-storage";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = { useRouter };

/** Reads the token from the `#token=` fragment, else from this tab's storage; undefined until read, null when there is none. */
export function useInvitationToken({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}) {
  const router = d.useRouter();
  const [token, setToken] = useState<string | null>();
  const hasReadToken = useRef(false);

  useEffect(
    function readInvitationToken() {
      if (hasReadToken.current) return;
      hasReadToken.current = true;

      const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
      if (!fragmentToken) {
        setToken(readStoredInvitationToken());
        return;
      }

      storeInvitationToken(fragmentToken);
      router.replace(UrlService.invitations(), undefined, { shallow: true });
      setToken(fragmentToken);
    },
    [router]
  );

  return { token, forgetToken: forgetInvitationToken };
}
