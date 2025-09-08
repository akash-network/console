import React, { useCallback, useState } from "react";
import { AutoButton } from "@akashnetwork/ui/components";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { ArrowRight } from "iconoir-react";
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
  const gotoHome = useCallback(() => {
    window.location.href = UrlService.home();
  }, []);

  return (
    <div className="mt-10 text-center">
      {isVerified ? (
        <>
          <CheckCircleIcon className="mb-2 h-16 w-16 text-green-500" />
          <h5>
            Your email was verified.
            <br />
            You can continue using the application.
          </h5>
          <AutoButton
            onClick={gotoHome}
            text={
              <>
                Continue <ArrowRight className="ml-4" />
              </>
            }
            timeout={5000}
          />
        </>
      ) : (
        <>
          <ErrorOutlineIcon className="mb-2 h-16 w-16 text-red-500" />
          <h5>Your email was not verified. Please try again.</h5>
        </>
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
