import React from "react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

export const TermsAndConditions: React.FC = () => (
  <div className="mx-auto max-w-md text-center">
    <p className="text-xs text-muted-foreground">
      By starting your trial, you agree to our{" "}
      <Link href={UrlService.termsOfService()} className="text-primary hover:underline">
        Terms of Service
      </Link>{" "}
      and{" "}
      <Link href={UrlService.privacyPolicy()} className="text-primary hover:underline">
        Privacy Policy
      </Link>
    </p>
  </div>
);
