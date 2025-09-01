import React, { useState } from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { ArrowRight } from "iconoir-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { NextSeo } from "next-seo";

import Layout, { Loading } from "@src/components/layout/Layout";
import { useWhen } from "@src/hooks/useWhen";
import { useVerifyEmail } from "@src/queries/useVerifyEmailQuery";
import { UrlService } from "@src/utils/urlUtils";

type VerificationResultProps = {
  isVerified: boolean;
};

function VerificationResult({ isVerified }: VerificationResultProps) {
  return (
    <div className="mt-10 text-center">
      {isVerified ? <CheckCircleIcon className="mb-2 h-16 w-16 text-green-500" /> : <ErrorOutlineIcon className="mb-2 h-16 w-16 text-red-500" />}
      <h5>
        {isVerified ? (
          <>
            Your email was verified.
            <br />
            You can continue using the application.
          </>
        ) : (
          "Your email was not verified. Please try again."
        )}
      </h5>
      {isVerified && (
        <div className="pt-6">
          <Link href={UrlService.home()} className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center")}>
            Continue
            <ArrowRight className="ml-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
export default function VerifyEmailPage() {
  const email = useSearchParams().get("email");
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const { mutate: verifyEmail, isPending: isVerifying } = useVerifyEmail({ onSuccess: setIsVerified, onError: () => setIsVerified(false) });

  useWhen(email, () => {
    if (email) {
      verifyEmail(email);
    }
  });

  return (
    <Layout>
      <NextSeo title="Verifying your email" />
      {isVerifying ? (
        <Loading text="Just a moment while we finish verifying your email." />
      ) : (
        <>
          <VerificationResult isVerified={isVerified === true} />
        </>
      )}
    </Layout>
  );
}
