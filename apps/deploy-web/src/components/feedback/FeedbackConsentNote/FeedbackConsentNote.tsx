import type { FC } from "react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

type Props = {
  sentWith: string;
};

export const FeedbackConsentNote: FC<Props> = ({ sentWith }) => (
  <p className="text-xs text-muted-foreground">
    Sent to the Akash team with {sentWith}.{" "}
    <Link href={UrlService.privacyPolicy()} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
      Privacy policy
    </Link>
  </p>
);
