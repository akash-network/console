import { useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { UrlService } from "@src/utils/urlUtils";
import { dseqOfPath } from "../dseqOfPath/dseqOfPath";

export const DEPENDENCIES = { useRouter, usePathname };

/** Takes the user to the deployment an action card acted on; the panel lives above the pages, so it stays open on the way. */
export function useFollowDeployment(d: typeof DEPENDENCIES = DEPENDENCIES) {
  const router = d.useRouter();
  const pathname = d.usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  return useCallback(
    (dseq: string) => {
      if (dseqOfPath(pathnameRef.current) === dseq) return;
      router.push(UrlService.deploymentDetails(dseq));
    },
    [router]
  );
}
