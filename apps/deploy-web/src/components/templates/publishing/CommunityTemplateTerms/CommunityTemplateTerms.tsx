import type { FC } from "react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

export const COMMUNITY_TEMPLATE_TERMS_SUMMARY = "anyone can deploy and fork this template, and Akash can hide or remove it";

export const CommunityTemplateTerms: FC<{ version: string }> = ({ version }) => (
  <details className="mt-1.5 text-[13px] text-muted-foreground">
    <summary className="cursor-pointer text-foreground underline underline-offset-[3px]">Read the community template terms</summary>
    <div className="mt-2 rounded-lg border border-border bg-muted/50 px-3.5 py-3">
      <ul className="flex list-disc flex-col gap-1.5 pl-4">
        <li>Anyone can find, deploy and fork a public template. A fork is its own copy, so it stays when you make yours private or delete it.</li>
        <li>Akash can hide or remove a public template, for example after a report or when a new version fails the publish checks.</li>
        <li>
          Keep your own keys and passwords out of it, and don&apos;t publish anything the{" "}
          <Link href={UrlService.prohibitedUse()} target="_blank" className="text-foreground underline underline-offset-[3px]">
            Terms of Service
          </Link>{" "}
          prohibit.
        </li>
        <li>You can make it private again at any time. Deployments that are already running keep running.</li>
      </ul>
      <p className="mt-2.5 text-xs">Terms version {version}</p>
    </div>
  </details>
);
